/**
 * @module primitives/channel-manager
 * @description Full implementation of the IChannel interface.
 *
 * Manages the Bond lifecycle including the 5-phase negotiation protocol,
 * care score tracking with exponential decay, and Tetrahedron (K4) topology
 * enforcement.
 *
 * Wire protocol prefixes for bond negotiation (no collision with transport layer):
 *   0x10 = BondChallenge (A1)
 *   0x11 = BondResponse  (A2)
 *   0x12 = BondConfirm   (A3)
 *   0x13 = BondData       (encrypted message over active bond)
 *
 * Bond negotiation wire format (all messages signed with ECDSA, ECDH keys exchanged inline):
 *   A1: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + nonce(32) + timestamp(4) + sig(64) = 167 bytes
 *   A2: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + respNonce(32) + echoedNonce(32) + timestamp(4) + sig(64) = 199 bytes
 *   A3: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + echoedNonce(32) + timestamp(4) + sig(64) = 167 bytes
 */

import { NodeZeroEmitter } from "./base-emitter.js";
import type { IChannel } from "../interfaces/channel.js";
import {
  ChannelError,
  MAX_BONDS_PER_CELL,
  DEFAULT_DECAY_CONFIG,
  DEFAULT_TIER_THRESHOLDS,
} from "../interfaces/channel.js";
import type { IIdentityProvider } from "../interfaces/identity-provider.js";
import type { ITransport } from "../interfaces/transport.js";
import type {
  NodeZeroBond,
  BondMessage,
  TrustTier,
  CareScoreComponents,
  MessageCallback,
} from "../types/bond.js";
import type {
  CompressedPublicKey,
  Normalized,
  NodeId,
  SharedSecret,
  UnixTimestamp,
  ChallengeNonce,
  KeySequence,
} from "../types/branded.js";
import { WebCryptoIdentityProvider } from "../backends/webcrypto-identity.js";
import {
  deriveSharedSecret,
  deriveNodeId,
  aesGcmEncrypt,
  aesGcmDecrypt,
  randomBytes,
} from "../backends/crypto-utils.js";

// ─── Bond Negotiation Wire Prefixes ─────────────────────────────────

const BOND_CHALLENGE = 0x10;
const BOND_RESPONSE = 0x11;
const BOND_CONFIRM = 0x12;
const BOND_DATA = 0x13;

const NEGOTIATION_TIMEOUT_MS = 30_000;

// ─── Internal interaction tracking (not part of the readonly bond) ──

interface BondInteractionState {
  sentCount: number;
  recvCount: number;
  dailyCounts: number[];
  responseTimesMs: number[];
  lastMessageSentAt: number;
}

/**
 * ChannelManager — Bond lifecycle and peer-to-peer messaging.
 *
 * @example
 * ```ts
 * const channel = new ChannelManager(identityProvider, transport);
 * await channel.initiate(peerPublicKey);
 * await channel.send({ type: "PING", payload: new Uint8Array(0), timestamp, senderId });
 * ```
 */
export class ChannelManager extends NodeZeroEmitter implements IChannel {
  private bonds: Map<string, NodeZeroBond> = new Map();
  private interactions: Map<string, BondInteractionState> = new Map();
  private messageListeners: Set<MessageCallback> = new Set();

  private pendingResponses = new Map<
    string,
    {
      resolve: (payload: Uint8Array) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private readonly identity: IIdentityProvider;
  private readonly transport: ITransport;
  private transportUnsub: (() => void) | null = null;

  constructor(identity: IIdentityProvider, transport: ITransport) {
    super();
    this.identity = identity;
    this.transport = transport;

    this.transportUnsub = this.transport.onReceive((data: Uint8Array) => {
      this.handleTransportMessage(data);
    });
  }

  // ─── Commands ───────────────────────────────────────────────────

  async initiate(targetPublicKey: CompressedPublicKey): Promise<void> {
    if (this.getActiveBondCount() >= MAX_BONDS_PER_CELL) {
      throw new ChannelError(
        `Cannot exceed ${MAX_BONDS_PER_CELL} bonds per cell (Tetrahedron topology)`,
        "TOPOLOGY_VIOLATION"
      );
    }

    const targetNodeId = await deriveNodeId(targetPublicKey);

    if (this.bonds.has(targetNodeId as string)) {
      throw new ChannelError(
        `Already bonded with ${targetNodeId}`,
        "ALREADY_BONDED"
      );
    }

    const wcIdentity = this.identity as WebCryptoIdentityProvider;
    const myIdentity = await this.identity.exportPublicKey();
    const myPubKey = myIdentity.publicKey.data;
    const myEcdhPub = await wcIdentity.getCompressedECDHPublicKey();
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Phase 2A: Generate and send BondChallenge (A1)
    // Wire: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + nonce(32) + timestamp(4) = 103 bytes + sig(64)
    const initiatorNonce = randomBytes(32) as ChallengeNonce;

    const challengePayload = new Uint8Array(103);
    challengePayload.set(myPubKey, 0);
    challengePayload[33] = myIdentity.recovery.keySequence as number;
    challengePayload.set(myEcdhPub, 34);
    challengePayload.set(initiatorNonce, 67);
    new DataView(challengePayload.buffer, 99, 4).setUint32(0, now, false);

    const challengeSig = await this.identity.sign(challengePayload);

    const challengeFrame = new Uint8Array(1 + 103 + 64);
    challengeFrame[0] = BOND_CHALLENGE;
    challengeFrame.set(challengePayload, 1);
    challengeFrame.set(challengeSig, 104);

    await this.transport.transmit(challengeFrame);

    // Phase 2B: Wait for BondResponse (A2)
    const responseRaw = await this.waitForMessage(
      targetNodeId as string,
      BOND_RESPONSE
    );

    // Parse A2: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + respNonce(32) + echoedNonce(32) + timestamp(4) + sig(64) = 199
    if (responseRaw.length < 199) {
      throw new ChannelError(
        "BondResponse too short",
        "NEGOTIATION_FAILED"
      );
    }

    const responderPubKey = responseRaw.slice(0, 33) as CompressedPublicKey;
    const responderKeySeq = responseRaw[33] as number;
    const responderEcdhPub = responseRaw.slice(34, 67) as CompressedPublicKey;
    const responderNonce = responseRaw.slice(67, 99) as ChallengeNonce;
    const echoedNonce = responseRaw.slice(99, 131);
    const responderPayload = responseRaw.slice(0, 135);
    const responderSig = responseRaw.slice(135, 199);

    if (!arrayEqual(echoedNonce, initiatorNonce)) {
      throw new ChannelError(
        "BondResponse echoed nonce mismatch",
        "VERIFICATION_FAILED"
      );
    }

    const sigValid = await this.identity.verify(
      responderPayload,
      responderSig as any,
      responderPubKey
    );
    if (!sigValid) {
      throw new ChannelError(
        "BondResponse signature verification failed",
        "VERIFICATION_FAILED"
      );
    }

    // Phase 2C: Send BondConfirm (A3)
    // Wire: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + echoedNonce(32) + timestamp(4) = 103 + sig(64)
    const confirmPayload = new Uint8Array(103);
    confirmPayload.set(myPubKey, 0);
    confirmPayload[33] = myIdentity.recovery.keySequence as number;
    confirmPayload.set(myEcdhPub, 34);
    confirmPayload.set(responderNonce, 67);
    const confirmNow = Math.floor(Date.now() / 1000) as UnixTimestamp;
    new DataView(confirmPayload.buffer, 99, 4).setUint32(0, confirmNow, false);

    const confirmSig = await this.identity.sign(confirmPayload);

    const confirmFrame = new Uint8Array(1 + 103 + 64);
    confirmFrame[0] = BOND_CONFIRM;
    confirmFrame.set(confirmPayload, 1);
    confirmFrame.set(confirmSig, 104);

    await this.transport.transmit(confirmFrame);

    // Phase 3: ECDH key agreement using ECDH keys (not ECDSA keys)
    const ecdhKey = wcIdentity.getECDHPrivateKey();

    const combinedNonces = new Uint8Array(64);
    combinedNonces.set(initiatorNonce, 0);
    combinedNonces.set(responderNonce, 32);

    const sharedSecret = await deriveSharedSecret(
      ecdhKey,
      responderEcdhPub,
      "node-zero-bond-v1",
      combinedNonces
    );

    // Phase 5: Create bond record
    this.createBondRecord(
      targetNodeId,
      targetPublicKey,
      responderKeySeq as KeySequence,
      sharedSecret,
      now
    );
  }

  async accept(initiatorPublicKey: CompressedPublicKey): Promise<void> {
    if (this.getActiveBondCount() >= MAX_BONDS_PER_CELL) {
      throw new ChannelError(
        `Cannot exceed ${MAX_BONDS_PER_CELL} bonds per cell`,
        "TOPOLOGY_VIOLATION"
      );
    }

    const initiatorNodeId = await deriveNodeId(initiatorPublicKey);

    if (this.bonds.has(initiatorNodeId as string)) {
      throw new ChannelError(
        `Already bonded with ${initiatorNodeId}`,
        "ALREADY_BONDED"
      );
    }

    // Wait for BondChallenge (A1) from initiator
    const challengeRaw = await this.waitForMessage(
      initiatorNodeId as string,
      BOND_CHALLENGE
    );

    // Parse A1: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + nonce(32) + timestamp(4) + sig(64) = 167
    if (challengeRaw.length < 167) {
      throw new ChannelError(
        "BondChallenge too short",
        "NEGOTIATION_FAILED"
      );
    }

    const challengerPubKey = challengeRaw.slice(0, 33) as CompressedPublicKey;
    const challengerKeySeq = challengeRaw[33] as number;
    const challengerEcdhPub = challengeRaw.slice(34, 67) as CompressedPublicKey;
    const initiatorNonce = challengeRaw.slice(67, 99) as ChallengeNonce;
    const challengePayload = challengeRaw.slice(0, 103);
    const challengeSig = challengeRaw.slice(103, 167);

    const sigValid = await this.identity.verify(
      challengePayload,
      challengeSig as any,
      challengerPubKey
    );
    if (!sigValid) {
      throw new ChannelError(
        "BondChallenge signature verification failed",
        "VERIFICATION_FAILED"
      );
    }

    // Generate BondResponse (A2)
    const wcIdentity = this.identity as WebCryptoIdentityProvider;
    const myIdentity = await this.identity.exportPublicKey();
    const myPubKey = myIdentity.publicKey.data;
    const myEcdhPub = await wcIdentity.getCompressedECDHPublicKey();
    const responderNonce = randomBytes(32) as ChallengeNonce;
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // A2: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + respNonce(32) + echoedNonce(32) + timestamp(4) = 135 + sig(64) = 199
    const responsePayload = new Uint8Array(135);
    responsePayload.set(myPubKey, 0);
    responsePayload[33] = myIdentity.recovery.keySequence as number;
    responsePayload.set(myEcdhPub, 34);
    responsePayload.set(responderNonce, 67);
    responsePayload.set(initiatorNonce, 99);
    new DataView(responsePayload.buffer, 131, 4).setUint32(0, now, false);

    const responseSig = await this.identity.sign(responsePayload);

    const responseFrame = new Uint8Array(1 + 135 + 64);
    responseFrame[0] = BOND_RESPONSE;
    responseFrame.set(responsePayload, 1);
    responseFrame.set(responseSig, 136);

    await this.transport.transmit(responseFrame);

    // Wait for BondConfirm (A3)
    const confirmRaw = await this.waitForMessage(
      initiatorNodeId as string,
      BOND_CONFIRM
    );

    // Parse A3: ecdsaPub(33) + keySeq(1) + ecdhPub(33) + echoedNonce(32) + timestamp(4) + sig(64) = 167
    if (confirmRaw.length < 167) {
      throw new ChannelError(
        "BondConfirm too short",
        "NEGOTIATION_FAILED"
      );
    }

    const confirmPubKey = confirmRaw.slice(0, 33) as CompressedPublicKey;
    const echoedResponderNonce = confirmRaw.slice(67, 99);
    const confirmPayload = confirmRaw.slice(0, 103);
    const confirmSig = confirmRaw.slice(103, 167);

    if (!arrayEqual(echoedResponderNonce, responderNonce)) {
      throw new ChannelError(
        "BondConfirm echoed nonce mismatch",
        "VERIFICATION_FAILED"
      );
    }

    const confirmValid = await this.identity.verify(
      confirmPayload,
      confirmSig as any,
      confirmPubKey
    );
    if (!confirmValid) {
      throw new ChannelError(
        "BondConfirm signature verification failed",
        "VERIFICATION_FAILED"
      );
    }

    // Phase 3: ECDH key agreement using ECDH keys (not ECDSA keys)
    const ecdhKey = wcIdentity.getECDHPrivateKey();

    const combinedNonces = new Uint8Array(64);
    combinedNonces.set(initiatorNonce, 0);
    combinedNonces.set(responderNonce, 32);

    const sharedSecret = await deriveSharedSecret(
      ecdhKey,
      challengerEcdhPub,
      "node-zero-bond-v1",
      combinedNonces
    );

    // Phase 5: Create bond record
    this.createBondRecord(
      initiatorNodeId,
      initiatorPublicKey,
      challengerKeySeq as KeySequence,
      sharedSecret,
      now
    );
  }

  async send(message: BondMessage): Promise<void> {
    const bond = this.bonds.get(message.senderId as string);
    if (!bond) {
      throw new ChannelError(
        `No active bond with ${message.senderId}`,
        "BOND_NOT_FOUND"
      );
    }

    if (bond.channel.status !== "ACTIVE") {
      throw new ChannelError(
        `Bond with ${message.senderId} is not active`,
        "SEND_FAILED"
      );
    }

    // Serialize: type(1) + timestamp(4) + senderIdLen(1) + senderId + payload
    const senderBytes = new TextEncoder().encode(message.senderId as string);
    const typeCode = encodeMessageType(message.type);
    const wire = new Uint8Array(1 + 4 + 1 + senderBytes.length + message.payload.length);
    wire[0] = typeCode;
    new DataView(wire.buffer, 1, 4).setUint32(0, message.timestamp as number, false);
    wire[5] = senderBytes.length;
    wire.set(senderBytes, 6);
    wire.set(message.payload, 6 + senderBytes.length);

    const { ciphertext, nonce } = await aesGcmEncrypt(
      bond.channel.sharedSecret,
      wire
    );

    // Frame: prefix(1) + nonce(12) + ciphertext
    const frame = new Uint8Array(1 + 12 + ciphertext.length);
    frame[0] = BOND_DATA;
    frame.set(nonce, 1);
    frame.set(ciphertext, 13);

    await this.transport.transmit(frame);

    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
    this.updateBondChannel(message.senderId, now, 1);

    const tracking = this.interactions.get(message.senderId as string);
    if (tracking) {
      tracking.sentCount++;
      tracking.lastMessageSentAt = Date.now();
    }
  }

  receive(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  async close(peerId: NodeId): Promise<void> {
    const bond = this.bonds.get(peerId as string);
    if (!bond) {
      throw new ChannelError(
        `No bond with ${peerId}`,
        "BOND_NOT_FOUND"
      );
    }

    this.bonds.delete(peerId as string);
    this.interactions.delete(peerId as string);

    this.emit({
      type: "BOND_TERMINATED",
      peerId,
      reason: 0,
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
    });
  }

  /**
   * Tear down transport listener. Call on shutdown.
   */
  destroy(): void {
    if (this.transportUnsub) {
      this.transportUnsub();
      this.transportUnsub = null;
    }
    for (const pending of this.pendingResponses.values()) {
      clearTimeout(pending.timer);
      pending.reject(new ChannelError("Channel destroyed", "NEGOTIATION_FAILED"));
    }
    this.pendingResponses.clear();
  }

  // ─── Queries ────────────────────────────────────────────────────

  getCareScore(peerId: NodeId): Normalized {
    const bond = this.bonds.get(peerId as string);
    if (!bond) {
      throw new ChannelError(
        `No bond with ${peerId}`,
        "BOND_NOT_FOUND"
      );
    }
    return bond.trust.careScore;
  }

  getCareScoreComponents(peerId: NodeId): CareScoreComponents {
    const bond = this.bonds.get(peerId as string);
    if (!bond) {
      throw new ChannelError(
        `No bond with ${peerId}`,
        "BOND_NOT_FOUND"
      );
    }
    return { ...bond.trust.components };
  }

  getTrustTier(peerId: NodeId): TrustTier {
    const bond = this.bonds.get(peerId as string);
    if (!bond) {
      throw new ChannelError(
        `No bond with ${peerId}`,
        "BOND_NOT_FOUND"
      );
    }
    return bond.trust.tier;
  }

  listBonds(): readonly NodeZeroBond[] {
    return Array.from(this.bonds.values());
  }

  getBond(peerId: NodeId): NodeZeroBond | undefined {
    return this.bonds.get(peerId as string);
  }

  getActiveBondCount(): number {
    return Array.from(this.bonds.values()).filter(
      (b) => b.channel.status === "ACTIVE"
    ).length;
  }

  // ─── Public: Care Score Lifecycle ────────────────────────────────

  /**
   * Recalculate and update the care score for a bond.
   * Called by the daily background scheduler or manually for testing.
   *
   * Emits CARE_SCORE_UPDATED. If the tier changes, also emits BOND_TRUST_CHANGED.
   */
  updateCareScore(peerId: NodeId, daysSinceLastInteraction = 0): void {
    const bond = this.bonds.get(peerId as string);
    if (!bond) {
      throw new ChannelError(
        `No bond with ${peerId}`,
        "BOND_NOT_FOUND"
      );
    }

    const tracking = this.interactions.get(peerId as string);
    if (!tracking) return;

    // Compute average response time in minutes
    const avgResponseMs =
      tracking.responseTimesMs.length > 0
        ? tracking.responseTimesMs.reduce((a, b) => a + b, 0) / tracking.responseTimesMs.length
        : 0;
    const avgResponseMinutes = avgResponseMs / 60_000;

    // Compute raw score from components
    const rawScore = this.recalculateCareScore(
      peerId,
      tracking.sentCount,
      tracking.recvCount,
      tracking.dailyCounts.length > 0 ? tracking.dailyCounts : [tracking.sentCount + tracking.recvCount],
      avgResponseMinutes
    );

    // Apply exponential decay
    const decayedScore = daysSinceLastInteraction > 0
      ? this.applyDecay(rawScore, daysSinceLastInteraction)
      : rawScore;

    const previousTier = bond.trust.tier;
    const newTier = this.scoreToTier(decayedScore, previousTier);
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Compute individual components for storage
    const total = tracking.sentCount + tracking.recvCount;
    const frequency = Math.min(1.0, total / 140) as Normalized;
    let reciprocity: Normalized;
    if (total < 3) {
      reciprocity = 0.5 as Normalized;
    } else {
      reciprocity = Math.min(
        1.0,
        Math.min(tracking.sentCount, tracking.recvCount) /
          Math.max(1, Math.max(tracking.sentCount, tracking.recvCount))
      ) as Normalized;
    }
    const dailyCounts = tracking.dailyCounts.length > 0 ? tracking.dailyCounts : [total];
    let consistency = 1.0 as Normalized;
    if (dailyCounts.length > 1) {
      const mean = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
      const variance =
        dailyCounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyCounts.length;
      const stddev = Math.sqrt(variance);
      consistency = (1.0 / (1.0 + stddev / (mean + 0.1))) as Normalized;
    }
    const responsiveness = Math.max(0, Math.min(1.0, (60 - avgResponseMinutes) / 60)) as Normalized;

    // Update bond record
    const updated: NodeZeroBond = {
      ...bond,
      trust: {
        careScore: decayedScore,
        components: { frequency, reciprocity, consistency, responsiveness },
        tier: newTier,
      },
    };
    this.bonds.set(peerId as string, updated);

    this.emit({
      type: "CARE_SCORE_UPDATED",
      peerId,
      score: decayedScore,
      timestamp: now,
    });

    if (newTier !== previousTier) {
      this.emit({
        type: "BOND_TRUST_CHANGED",
        peerId,
        previousTier,
        currentTier: newTier,
        careScore: decayedScore,
        timestamp: now,
      });
    }
  }

  // ─── Internal: Care Score Calculation ───────────────────────────

  /**
   * Compute raw composite care score.
   *
   * CS = 0.3*F + 0.3*R + 0.2*C + 0.2*Resp
   */
  protected recalculateCareScore(
    _peerId: NodeId,
    sentCount: number,
    recvCount: number,
    dailyCounts: number[],
    avgResponseTime: number
  ): Normalized {
    const total = sentCount + recvCount;

    const frequency = Math.min(1.0, total / 140);

    let reciprocity: number;
    if (total < 3) {
      reciprocity = 0.5;
    } else {
      reciprocity = Math.min(
        1.0,
        Math.min(sentCount, recvCount) / Math.max(1, Math.max(sentCount, recvCount))
      );
    }

    let consistency = 1.0;
    if (dailyCounts.length > 1) {
      const mean = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
      const variance =
        dailyCounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyCounts.length;
      const stddev = Math.sqrt(variance);
      consistency = 1.0 / (1.0 + stddev / (mean + 0.1));
    }

    const responsiveness = Math.max(0, Math.min(1.0, (60 - avgResponseTime) / 60));

    const composite = 0.3 * frequency + 0.3 * reciprocity + 0.2 * consistency + 0.2 * responsiveness;

    return Math.max(0, Math.min(1.0, composite)) as Normalized;
  }

  /**
   * Apply exponential decay: CS(t) = CS(0) * e^(-lambda*t)
   * where lambda = ln(2) / halfLifeDays
   */
  protected applyDecay(score: Normalized, daysSinceInteraction: number): Normalized {
    const lambda = Math.LN2 / DEFAULT_DECAY_CONFIG.halfLifeDays;
    const decayed = (score as number) * Math.exp(-lambda * daysSinceInteraction);
    return Math.max(0, decayed) as Normalized;
  }

  /**
   * Derive trust tier from care score using configured thresholds.
   * Hysteresis band (±0.02) prevents chatter at tier boundaries.
   */
  protected scoreToTier(score: Normalized, currentTier?: TrustTier): TrustTier {
    const s = score as number;
    const H = 0.02;
    const resonant = DEFAULT_TIER_THRESHOLDS.resonant as number;
    const coherent = DEFAULT_TIER_THRESHOLDS.coherent as number;
    const strut = DEFAULT_TIER_THRESHOLDS.strut as number;

    if (currentTier === "RESONANT") {
      if (s >= resonant - H) return "RESONANT";
    } else {
      if (s >= resonant + H) return "RESONANT";
    }

    if (currentTier === "COHERENT") {
      if (s >= coherent - H && s < resonant + H) return "COHERENT";
    } else {
      if (s >= coherent + H) return "COHERENT";
    }

    if (currentTier === "STRUT") {
      if (s >= strut - H) return "STRUT";
    } else {
      if (s >= strut + H) return "STRUT";
    }

    return "GHOST";
  }

  // ─── Internal: Transport Message Dispatch ───────────────────────

  private handleTransportMessage(data: Uint8Array): void {
    if (data.length < 2) return;
    const prefix = data[0]!;

    switch (prefix) {
      case BOND_CHALLENGE:
      case BOND_RESPONSE:
      case BOND_CONFIRM:
        this.handleNegotiationMessage(prefix, data.slice(1));
        break;
      case BOND_DATA:
        this.handleBondData(data.slice(1));
        break;
    }
  }

  private handleNegotiationMessage(prefix: number, payload: Uint8Array): void {
    if (payload.length < 33) return;

    const senderPubKey = payload.slice(0, 33) as CompressedPublicKey;
    deriveNodeId(senderPubKey).then((senderNodeId) => {
      const key = `${senderNodeId}:${prefix}`;
      const pending = this.pendingResponses.get(key);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingResponses.delete(key);
        pending.resolve(payload);
      }
    });
  }

  private async handleBondData(payload: Uint8Array): Promise<void> {
    if (payload.length < 13) return;

    const nonce = payload.slice(0, 12);
    const ciphertext = payload.slice(12);

    for (const [peerId, bond] of this.bonds) {
      if (bond.channel.status !== "ACTIVE") continue;

      try {
        const plaintext = await aesGcmDecrypt(
          bond.channel.sharedSecret,
          ciphertext as any,
          nonce as any
        );

        if (plaintext.length < 6) continue;
        const typeCode = plaintext[0]!;
        const timestamp = new DataView(
          plaintext.buffer,
          plaintext.byteOffset + 1,
          4
        ).getUint32(0, false) as UnixTimestamp;
        const senderIdLen = plaintext[5]!;
        const senderId = new TextDecoder().decode(
          plaintext.slice(6, 6 + senderIdLen)
        ) as NodeId;
        const msgPayload = plaintext.slice(6 + senderIdLen);

        const message: BondMessage = {
          type: decodeMessageType(typeCode),
          payload: msgPayload,
          timestamp,
          senderId,
        };

        const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
        this.updateBondChannel(peerId as NodeId, now, 1);

        const tracking = this.interactions.get(peerId);
        if (tracking) {
          tracking.recvCount++;
          if (tracking.lastMessageSentAt > 0) {
            tracking.responseTimesMs.push(Date.now() - tracking.lastMessageSentAt);
          }
        }

        this.emit({
          type: "BOND_MESSAGE_RECEIVED",
          message,
          timestamp: now,
        });

        for (const listener of this.messageListeners) {
          listener(message);
        }
        return;
      } catch {
        // Wrong key — try next bond
      }
    }
  }

  // ─── Internal: Helpers ──────────────────────────────────────────

  private waitForMessage(
    peerNodeId: string,
    messageType: number
  ): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const key = `${peerNodeId}:${messageType}`;
      const timer = setTimeout(() => {
        this.pendingResponses.delete(key);
        reject(
          new ChannelError(
            `Timed out waiting for message type 0x${messageType.toString(16)} from ${peerNodeId}`,
            "NEGOTIATION_TIMEOUT"
          )
        );
      }, NEGOTIATION_TIMEOUT_MS);

      this.pendingResponses.set(key, { resolve, reject, timer });
    });
  }

  private createBondRecord(
    peerId: NodeId,
    peerPublicKey: CompressedPublicKey,
    peerKeySequence: KeySequence,
    sharedSecret: SharedSecret,
    timestamp: UnixTimestamp
  ): void {
    const defaultComponents: CareScoreComponents = {
      frequency: 0.5 as Normalized,
      reciprocity: 0.5 as Normalized,
      consistency: 1.0 as Normalized,
      responsiveness: 1.0 as Normalized,
    };
    const initialScore = 0.5 as Normalized;

    const bond: NodeZeroBond = {
      version: 1,
      partner: {
        nodeId: peerId,
        publicKey: peerPublicKey,
        keySequence: peerKeySequence as number,
      },
      trust: {
        careScore: initialScore,
        components: defaultComponents,
        tier: this.scoreToTier(initialScore),
      },
      channel: {
        sharedSecret,
        lastInteraction: timestamp,
        totalExchanges: 0,
        status: "ACTIVE",
      },
      permissions: {
        grantedVaultLayers: [],
        stateVisibility: "VOLTAGE",
      },
      createdAt: timestamp,
    };

    this.bonds.set(peerId as string, bond);

    this.interactions.set(peerId as string, {
      sentCount: 0,
      recvCount: 0,
      dailyCounts: [],
      responseTimesMs: [],
      lastMessageSentAt: 0,
    });

    this.emit({
      type: "BOND_FORMED",
      bond,
      timestamp,
    });
  }

  private updateBondChannel(
    peerId: NodeId | string,
    timestamp: UnixTimestamp,
    exchangesDelta: number
  ): void {
    const key = peerId as string;
    const existing = this.bonds.get(key);
    if (!existing) return;

    const updated: NodeZeroBond = {
      ...existing,
      channel: {
        ...existing.channel,
        lastInteraction: timestamp,
        totalExchanges: existing.channel.totalExchanges + exchangesDelta,
      },
    };

    this.bonds.set(key, updated);
  }
}

// ─── Utility ───────────────────────────────────────────────────────

function arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function encodeMessageType(
  type: BondMessage["type"]
): number {
  switch (type) {
    case "STATE_UPDATE": return 0x01;
    case "VAULT_REQUEST": return 0x02;
    case "VAULT_GRANT": return 0x03;
    case "VAULT_FRAGMENT": return 0x04;
    case "PING": return 0x05;
    case "CUSTOM": return 0x06;
  }
}

function decodeMessageType(
  code: number
): BondMessage["type"] {
  switch (code) {
    case 0x01: return "STATE_UPDATE";
    case 0x02: return "VAULT_REQUEST";
    case 0x03: return "VAULT_GRANT";
    case 0x04: return "VAULT_FRAGMENT";
    case 0x05: return "PING";
    default: return "CUSTOM";
  }
}
