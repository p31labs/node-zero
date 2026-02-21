/**
 * @module interfaces/channel
 * @description IChannel — peer-to-peer Bond protocol management.
 *
 * Manages the Bond lifecycle: discovery, challenge-response authentication,
 * ECDH key agreement, trust negotiation, messaging, and termination.
 * Enforces the Tetrahedron (K4) topology constraint (max 4 nodes per cell).
 *
 * The Care Score is computed locally from interaction frequency, reciprocity,
 * consistency, and responsiveness. It decays exponentially (half-life: 14 days)
 * to encourage ongoing engagement.
 */

import type {
  NodeZeroBond,
  BondMessage,
  TrustTier,
  BondStatus,
  CareScoreComponents,
  CareScoreDecayConfig,
  TrustTierThresholds,
  MessageCallback,
} from "../types/bond.js";
import type { CompressedPublicKey, Normalized, NodeId } from "../types/branded.js";

/**
 * Maximum bonds per cell (Tetrahedron topology: K4).
 */
export const MAX_BONDS_PER_CELL = 4;

/**
 * Default care score decay configuration.
 */
export const DEFAULT_DECAY_CONFIG: CareScoreDecayConfig = {
  halfLifeDays: 14,
  minimumThreshold: 0.1 as Normalized,
};

/**
 * Default trust tier thresholds.
 */
export const DEFAULT_TIER_THRESHOLDS: TrustTierThresholds = {
  strut: 0.2 as Normalized,
  coherent: 0.5 as Normalized,
  resonant: 0.8 as Normalized,
};

/**
 * Errors that may be thrown by IChannel operations.
 */
export class ChannelError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TOPOLOGY_VIOLATION"
      | "BOND_NOT_FOUND"
      | "NEGOTIATION_FAILED"
      | "NEGOTIATION_TIMEOUT"
      | "ALREADY_BONDED"
      | "VERIFICATION_FAILED"
      | "SEND_FAILED"
  ) {
    super(message);
    this.name = "ChannelError";
  }
}

/**
 * @interface IChannel
 * @description Manages the Bond lifecycle and high-level messaging.
 * Enforces the Tetrahedron (K4) topology and Care Score tracking.
 */
export interface IChannel {
  // ─── Commands ───────────────────────────────────────────────────

  /**
   * @command
   * @description Initiates a Bond negotiation with a target identity.
   *
   * Executes the 5-phase protocol:
   * 1. Discovery (out-of-band, already completed)
   * 2. Challenge-Response (mutual ECDSA authentication)
   * 3. Key Agreement (ECDH → HKDF → bond channel key)
   * 4. Trust Negotiation (exchange visibility/layer preferences)
   * 5. Confirmation (both sides ACTIVE)
   *
   * @param targetPublicKey - Compressed P-256 public key of the target node.
   * @postcondition Bond enters NEGOTIATING then ACTIVE state.
   *               Emits BOND_FORMED on success.
   * @throws {ChannelError} code=TOPOLOGY_VIOLATION if bonding would exceed 4-node limit.
   * @throws {ChannelError} code=ALREADY_BONDED if already bonded with this identity.
   * @throws {ChannelError} code=NEGOTIATION_TIMEOUT if challenge-response times out (30s).
   */
  initiate(targetPublicKey: CompressedPublicKey): Promise<void>;

  /**
   * @command
   * @description Accepts a Bond request and derives a shared session secret.
   *
   * Responds to Phase 2 (A1 challenge) with A2 response, then waits
   * for A3 confirm. After mutual authentication, performs ECDH to
   * derive the bond channel key.
   *
   * @param initiatorPublicKey - Compressed P-256 public key of the requester.
   * @postcondition Shared secret persisted in secure element.
   *               Emits BOND_FORMED on success.
   * @throws {ChannelError} code=TOPOLOGY_VIOLATION if accepting would exceed limit.
   * @throws {ChannelError} code=VERIFICATION_FAILED if initiator signature invalid.
   */
  accept(initiatorPublicKey: CompressedPublicKey): Promise<void>;

  /**
   * @command
   * @description Encrypts and transmits a message to a bonded peer.
   *
   * The message is encrypted with the bond's AES-256-GCM channel key,
   * fragmented if necessary, and queued in ITransport.
   *
   * @param message - The payload (state update, vault request, etc.).
   * @postcondition Message fragmented and queued in ITransport.
   *               Updates interaction stats for care score calculation.
   * @throws {ChannelError} code=BOND_NOT_FOUND if no active bond with peer.
   * @throws {ChannelError} code=SEND_FAILED if transport layer unavailable.
   */
  send(message: BondMessage): Promise<void>;

  /**
   * @command
   * @description Registers a listener for incoming bond messages.
   *
   * Messages are decrypted using the bond channel key, reassembled
   * from fragments, and delivered to the callback.
   *
   * @param callback - Function called with each reassembled, decrypted message.
   * @returns Unsubscribe function.
   */
  receive(callback: MessageCallback): () => void;

  /**
   * @command
   * @description Terminates a bond and wipes the associated shared secret.
   *
   * Sends a signed bond_terminate message to the peer, then deletes
   * the bond record and revokes all vault access tokens.
   *
   * @param peerId - NodeId of the bond to terminate.
   * @postcondition Emits BOND_TERMINATED; triggers FRACTURED state protocol.
   * @throws {ChannelError} code=BOND_NOT_FOUND if no bond with this peer.
   */
  close(peerId: NodeId): Promise<void>;

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * @query
   * @description Calculates the current care score for a specific bond.
   *
   * CS = 0.3×Frequency + 0.3×Reciprocity + 0.2×Consistency + 0.2×Responsiveness
   *
   * Updated daily using a 7-day sliding window.
   *
   * @param peerId - The bonded peer to evaluate.
   * @returns The composite care score [0.0, 1.0].
   * @throws {ChannelError} code=BOND_NOT_FOUND if no bond with this peer.
   */
  getCareScore(peerId: NodeId): Normalized;

  /**
   * @query
   * @description Returns the care score component breakdown for a bond.
   *
   * @param peerId - The bonded peer to evaluate.
   * @returns Individual frequency, reciprocity, consistency, responsiveness scores.
   */
  getCareScoreComponents(peerId: NodeId): CareScoreComponents;

  /**
   * @query
   * @description Returns the current trust tier for a specific bond.
   *
   * | Care Score | Trust Tier |
   * |------------|------------|
   * | < 0.2      | GHOST      |
   * | 0.2–0.5    | STRUT      |
   * | 0.5–0.8    | COHERENT   |
   * | ≥ 0.8      | RESONANT   |
   */
  getTrustTier(peerId: NodeId): TrustTier;

  /**
   * @query
   * @description Returns all active bonds.
   */
  listBonds(): readonly NodeZeroBond[];

  /**
   * @query
   * @description Returns a specific bond record by peer NodeId.
   *
   * @param peerId - The peer to look up.
   * @returns The bond record, or undefined if not found.
   */
  getBond(peerId: NodeId): NodeZeroBond | undefined;

  /**
   * @query
   * @description Returns the number of currently active bonds.
   * Used for tetrahedron topology enforcement.
   */
  getActiveBondCount(): number;
}
