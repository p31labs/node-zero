/**
 * @module node
 * @description NodeZero — the orchestrator that wires all primitives together.
 *
 * A NodeZero instance manages:
 * - Identity (key generation, signing, verification)
 * - State (metabolic vector, voltage, spoons, scope tier)
 * - Vault (layered encrypted storage)
 * - Bonds (authenticated channels with peer nodes)
 * - Transport (WebSocket/BroadcastChannel communication)
 *
 * Note: The skeleton primitives' initiate/accept/broadcast methods throw
 * "not implemented". This orchestrator handles those flows directly,
 * bypassing the skeleton stubs until they're fully wired.
 *
 * @example
 * ```ts
 * const node = new NodeZero();
 * await node.boot();
 *
 * node.onPeerDiscovered(async (peer) => {
 *   await node.initiateBond(peer);
 * });
 *
 * await node.updateState("URGENCY", 0.3);
 * ```
 */

import { WebCryptoIdentityProvider } from "./backends/webcrypto-identity.js";
import { StateEngine } from "./primitives/state-engine.js";
import { VaultStore } from "./primitives/vault-store.js";
import { BroadcastChannelTransport } from "./transports/websocket.js";
import {
  serializeStateUpdate,
  deserializeStateUpdate,
} from "./codec/index.js";
import {
  deriveSharedSecret,
  deriveNodeId,
} from "./backends/crypto-utils.js";
import type {
  NodeId,
  CompressedPublicKey,
  SharedSecret,
  UnixTimestamp,
  Uint8 as U8,
} from "./types/branded.js";
import type { Axis, StateWireData } from "./types/state.js";
import type { DiscoveredPeer } from "./types/transport.js";
import type { NodeZeroIdentity } from "./types/identity.js";
import type { BondStatus, TrustTier } from "./types/bond.js";

// ─── Configuration ────────────────────────────────────────────────

export interface NodeZeroConfig {
  /** BroadcastChannel name for same-origin transport. Default: "node-zero-mesh" */
  channelName?: string;
  /** State broadcast interval in milliseconds. Default: 10000 (10s) */
  broadcastInterval?: number;
  /** Auto-discover peers on boot. Default: true */
  autoDiscover?: boolean;
  /** Discovery beacon interval in milliseconds. Default: 5000 */
  discoveryInterval?: number;
}

// ─── Local Bond Record ────────────────────────────────────────────

export interface LocalBond {
  peerId: NodeId;
  peerPublicKey: CompressedPublicKey;
  sharedSecret: SharedSecret;
  status: BondStatus;
  trustTier: TrustTier;
  careScore: number;
  createdAt: number;
  lastInteraction: number;
  totalExchanges: number;
}

// ─── Orchestrator ──────────────────────────────────────────────────

export class NodeZero {
  readonly identity: WebCryptoIdentityProvider;
  readonly state: StateEngine;
  readonly vault: VaultStore;
  readonly transport: BroadcastChannelTransport;

  private config: Required<NodeZeroConfig>;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private booted = false;
  private lastBroadcastTime = 0;

  /** Local bond store (bypasses ChannelManager stubs) */
  private bonds = new Map<string, LocalBond>();

  // Event callbacks
  private peerCallbacks = new Set<(peer: DiscoveredPeer) => void>();
  private bondCallbacks = new Set<(bond: LocalBond) => void>();
  private stateCallbacks = new Set<
    (
      nodeId: NodeId,
      state: { voltage: number; spoons: number; tier: string }
    ) => void
  >();

  constructor(config: NodeZeroConfig = {}) {
    this.config = {
      channelName: config.channelName ?? "node-zero-mesh",
      broadcastInterval: config.broadcastInterval ?? 10000,
      autoDiscover: config.autoDiscover ?? true,
      discoveryInterval: config.discoveryInterval ?? 5000,
    };

    this.identity = new WebCryptoIdentityProvider();
    this.state = new StateEngine("pending" as NodeId);
    this.vault = new VaultStore();
    this.transport = new BroadcastChannelTransport(this.config.channelName);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  /**
   * Boot the node: generate identity, configure transport, start broadcasting.
   * @returns The full public identity.
   */
  async boot(): Promise<NodeZeroIdentity> {
    if (this.booted) {
      return this.identity.exportPublicKey();
    }

    // 1. Generate cryptographic identity
    await this.identity.generateKeypair();
    const fullIdentity = await this.identity.exportPublicKey();

    // 2. Configure transport
    await this.transport.configure({
      medium: "WEBSOCKET",
      mtu: 65535,
    });
    this.transport.setLocalIdentity(fullIdentity.publicKey.data);

    // 3. Wire up transport → receive handler
    this.transport.onReceive((data: Uint8Array) => {
      this.handleIncomingData(data);
    });

    // 4. Wire up peer discovery
    this.transport.onPeerDiscovered((peer: DiscoveredPeer) => {
      for (const cb of this.peerCallbacks) {
        cb(peer);
      }
    });

    // 5. Start periodic state broadcast
    this.broadcastTimer = setInterval(() => {
      this.broadcastState().catch(() => {});
    }, this.config.broadcastInterval);

    // 6. Start periodic discovery beacons
    if (this.config.autoDiscover) {
      await this.transport.discover();
      this.discoveryTimer = setInterval(() => {
        this.transport.discover().catch(() => {});
      }, this.config.discoveryInterval);
    }

    this.booted = true;
    return fullIdentity;
  }

  /**
   * Shut down the node cleanly.
   */
  shutdown(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    this.transport.close();
    this.peerCallbacks.clear();
    this.bondCallbacks.clear();
    this.stateCallbacks.clear();
    this.bonds.clear();
    this.booted = false;
  }

  // ─── State ──────────────────────────────────────────────────────

  /**
   * Update a state axis and trigger a broadcast.
   */
  async updateState(axis: Axis, value: number): Promise<void> {
    await this.state.updateAxis(axis, value);
    await this.broadcastState();
  }

  /**
   * Get the current voltage (composite stress metric).
   */
  getVoltage(): number {
    return this.state.getComposite().composite as number;
  }

  /**
   * Get the current spoon count.
   */
  getSpoons(): number {
    return this.state.getSpoonCount();
  }

  /**
   * Get the current scope tier.
   */
  getTier(): string {
    return this.state.getCurrentTier();
  }

  // ─── Bonds ──────────────────────────────────────────────────────

  /**
   * Initiate a bond with a discovered peer.
   * Bypasses the ChannelManager stub and handles ECDH directly.
   */
  async initiateBond(peer: DiscoveredPeer): Promise<LocalBond | null> {
    if (!peer.publicKey || peer.publicKey.length < 33) return null;

    const peerPubKey = peer.publicKey.slice(0, 33) as CompressedPublicKey;
    const peerNodeId = await deriveNodeId(peerPubKey);

    // Don't bond with self
    if (peerNodeId === this.identity.getNodeId()) return null;

    // Don't duplicate bonds
    if (this.bonds.has(peerNodeId as string)) {
      return this.bonds.get(peerNodeId as string)!;
    }

    // Enforce K4 topology (max 4 bonds)
    if (this.bonds.size >= 4) return null;

    // Derive shared secret via ECDH + HKDF
    const ecdhPrivate = this.identity.getECDHPrivateKey();
    const sharedSecret = await deriveSharedSecret(
      ecdhPrivate,
      peerPubKey,
      "node-zero-bond-v1"
    );

    const now = Math.floor(Date.now() / 1000);

    const bond: LocalBond = {
      peerId: peerNodeId,
      peerPublicKey: peerPubKey,
      sharedSecret,
      status: "ACTIVE",
      trustTier: "STRUT",
      careScore: 0.5,
      createdAt: now,
      lastInteraction: now,
      totalExchanges: 0,
    };

    this.bonds.set(peerNodeId as string, bond);

    for (const cb of this.bondCallbacks) {
      cb(bond);
    }

    return bond;
  }

  /**
   * Get all active bonds.
   */
  getActiveBonds(): LocalBond[] {
    return Array.from(this.bonds.values()).filter(
      (b) => b.status === "ACTIVE"
    );
  }

  /**
   * Get a specific bond.
   */
  getBond(peerId: NodeId): LocalBond | undefined {
    return this.bonds.get(peerId as string);
  }

  /**
   * Close a bond.
   */
  closeBond(peerId: NodeId): void {
    this.bonds.delete(peerId as string);
  }

  // ─── Events ─────────────────────────────────────────────────────

  /**
   * Register callback for peer discovery.
   */
  onPeerDiscovered(callback: (peer: DiscoveredPeer) => void): () => void {
    this.peerCallbacks.add(callback);
    return () => this.peerCallbacks.delete(callback);
  }

  /**
   * Register callback for bond formation.
   */
  onBondFormed(callback: (bond: LocalBond) => void): () => void {
    this.bondCallbacks.add(callback);
    return () => this.bondCallbacks.delete(callback);
  }

  /**
   * Register callback for receiving remote state updates.
   */
  onRemoteState(
    callback: (
      nodeId: NodeId,
      state: { voltage: number; spoons: number; tier: string }
    ) => void
  ): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Trigger peer discovery.
   */
  async discover(): Promise<void> {
    await this.transport.discover();
  }

  /**
   * Get current node summary.
   */
  getStatus(): {
    nodeId: NodeId;
    voltage: number;
    spoons: number;
    tier: string;
    bondCount: number;
    peers: readonly DiscoveredPeer[];
  } {
    return {
      nodeId: this.identity.getNodeId(),
      voltage: this.getVoltage(),
      spoons: this.getSpoons(),
      tier: this.getTier(),
      bondCount: this.bonds.size,
      peers: this.transport.getDiscoveredPeers(),
    };
  }

  // ─── Internal ───────────────────────────────────────────────────

  private async broadcastState(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (now - this.lastBroadcastTime < 5) return;
    this.lastBroadcastTime = now;

    try {
      const composite = this.state.getComposite();
      const pubKey = this.identity.getCompressedPublicKey();
      const keySequence = (await this.identity.exportPublicKey()).recovery
        .keySequence;

      // Quantize float values to uint8 for wire format
      const urgencyByte = Math.round(
        (composite.magnitudes.URGENCY as number) * 255
      ) as U8;
      const emotionalByte = Math.round(
        ((composite.magnitudes.VALENCE as number) + 1) * 127.5
      ) as U8;
      const cognitiveByte = Math.round(
        (composite.magnitudes.COGNITIVE as number) * 255
      ) as U8;

      const stateData: StateWireData = {
        urgency: urgencyByte,
        emotional: emotionalByte,
        cognitive: cognitiveByte,
        timestamp: now as UnixTimestamp,
      };

      // Build signed message: pubKey || urgency || emotional || cognitive
      const sigPayload = new Uint8Array(36);
      sigPayload.set(pubKey, 0);
      sigPayload[33] = urgencyByte as number;
      sigPayload[34] = emotionalByte as number;
      sigPayload[35] = cognitiveByte as number;

      const signature = await this.identity.sign(sigPayload);

      const wireMessage = serializeStateUpdate({
        identity: { publicKey: pubKey, keySequence },
        stateData,
        signature,
      });

      await this.transport.transmit(wireMessage);
    } catch {
      // Best-effort broadcast
    }
  }

  private handleIncomingData(data: Uint8Array): void {
    if (data.length === 105) {
      try {
        const update = deserializeStateUpdate(data);
        const peerPubKey = update.identity.publicKey;

        // Don't process our own broadcasts
        const localPub = this.identity.getCompressedPublicKey();
        if (arrayEqual(peerPubKey, localPub)) return;

        // Dequantize wire format back to floats
        const urgency = (update.stateData.urgency as number) / 255;
        const cognitive = (update.stateData.cognitive as number) / 255;
        const emotional =
          (update.stateData.emotional as number) / 127.5 - 1;

        const voltage =
          (urgency + Math.abs(emotional) * 0.5 + cognitive) / 2.5;
        const clampedVoltage = Math.max(0, Math.min(1, voltage));
        const spoons = Math.max(
          1,
          Math.min(12, Math.round(12 * (1 - clampedVoltage)))
        );
        const tier =
          spoons >= 9 ? "FULL" : spoons >= 4 ? "PATTERN" : "REFLEX";

        deriveNodeId(peerPubKey).then((peerId) => {
          for (const cb of this.stateCallbacks) {
            cb(peerId, { voltage: clampedVoltage, spoons, tier });
          }
        });
      } catch {
        // Invalid state update — ignore
      }
    }
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
