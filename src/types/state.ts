/**
 * @module types/state
 * @description State Primitive — the real-time metabolic pulse of a Node Zero instance.
 *
 * State is ephemeral and broadcast-only: the most recent vector replaces
 * the previous one. It maps the operator's cognitive/emotional/urgency
 * axes to a composite Voltage score, which in turn maps to a Spoon count
 * (1–12) governing the system's operational Scope tier.
 *
 * Conflict resolution: Gemini's 3-axis model + Spoon/Voltage/Scope tiers
 * merged with DeepSeek's compact 7-byte wire format and staleness detection.
 */

import type {
  NodeId,
  CompressedPublicKey,
  KeySequence,
  ECDSASignature,
  Normalized,
  SignedNormalized,
  Uint8,
  Int8,
  UnixTimestamp,
} from "./branded.js";
import type { CompactIdentity } from "./identity.js";

// ─── State Axes ─────────────────────────────────────────────────────

/**
 * Named axes of the state vector.
 * Extensible for future sensor integration (e.g., SENSORY, PHYSICAL).
 */
export type Axis = "URGENCY" | "VALENCE" | "COGNITIVE";

// ─── Scope Tiers ────────────────────────────────────────────────────

/**
 * Operational tier governing UI fidelity and processing depth.
 *
 * - `FULL`: High-fidelity UI, complex animations, deep LLM processing. (9–12 spoons)
 * - `PATTERN`: Muted colors, increased padding, simplified summaries. (4–8 spoons)
 * - `REFLEX`: Critical preservation, high contrast, stripped UI, async-only. (0–3 spoons)
 *
 * Visual elements in REFLEX must never flash above 3 Hz (below the
 * photosensitive epilepsy threshold of 15–25 Hz).
 */
export type ScopeTier = "REFLEX" | "PATTERN" | "FULL";

// ─── State Vector ───────────────────────────────────────────────────

/**
 * The three-axis metabolic vector representing operator capacity.
 */
export interface StateVector {
  /** Temporal pressure / immediate need for intervention. [0.0, 1.0] */
  readonly urgency: Normalized;
  /** Internal mood. [-1.0, +1.0] where -1.0 = dysregulated, +1.0 = expansive. */
  readonly valence: SignedNormalized;
  /** Current utilization of mental resources. [0.0, 1.0] */
  readonly cognitiveLoad: Normalized;
}

/**
 * Derived composite values from the raw state vector.
 */
export interface StateComposite {
  /** Composite stress metric. [0.0, 1.0] — higher = more stressed. */
  readonly voltage: Normalized;
  /** Discretized energy count. 1–12, mapped from voltage. */
  readonly spoons: number;
  /** Active operational tier derived from spoon count. */
  readonly tier: ScopeTier;
}

/**
 * Q Coherence value adjusted via the Trimtab (EC11 rotary encoder).
 * Represents the resonant stability of the node.
 * High Q = stable, high-energy state.
 */
export interface QCoherence {
  /** The raw Q value. [0.0, 1.0] */
  readonly value: Normalized;
  /** Whether the coherence beacon is active (Q ≈ 0.35 threshold). */
  readonly beaconActive: boolean;
}

// ─── Full State Object ──────────────────────────────────────────────

/**
 * The complete state of a Node Zero instance.
 * Broadcast-only, non-persistent, ephemeral.
 */
export interface NodeZeroState {
  /** Schema version for forward compatibility. */
  readonly version: number;
  /** Unix timestamp of this state snapshot. */
  readonly timestamp: UnixTimestamp;
  /** Raw three-axis metabolic vector. */
  readonly vector: StateVector;
  /** Derived voltage, spoons, and scope tier. */
  readonly composite: StateComposite;
  /** Q coherence from the Trimtab. */
  readonly coherence: QCoherence;
  /** Broadcast metadata. */
  readonly metadata: {
    /** Seconds until this state broadcast expires. Default: 300. */
    readonly ttl: number;
    /** NodeId of the broadcasting node. */
    readonly originNodeId: NodeId;
  };
}

// ─── Voltage Vector (Multi-Axis) ────────────────────────────────────

/**
 * Extended voltage vector for multi-dimensional state processing.
 * Used by the IStateEngine.getComposite() query.
 */
export interface VoltageVector {
  /** Per-axis magnitude values. */
  readonly magnitudes: Record<Axis, Normalized>;
  /** Composite voltage scalar. */
  readonly composite: Normalized;
  /** Current spoon count. */
  readonly spoons: number;
  /** Active scope tier. */
  readonly tier: ScopeTier;
}

// ─── Wire Format ────────────────────────────────────────────────────

/**
 * Compact state data for mesh transmission (7 bytes).
 *
 * | Field     | Size | Range                |
 * |-----------|------|----------------------|
 * | urgency   | 1    | 0–255 → [0.0, 1.0]  |
 * | emotional | 1    | 0–255 → [-1.0, +1.0] |
 * | cognitive | 1    | 0–255 → [0.0, 1.0]  |
 * | timestamp | 4    | Unix seconds (BE)    |
 */
export interface StateWireData {
  readonly urgency: Uint8;
  readonly emotional: Uint8;
  readonly cognitive: Uint8;
  readonly timestamp: UnixTimestamp;
}

/**
 * Signed state update message for mesh broadcast (105 bytes).
 *
 * Layout: compact_identity (34) || state_data (7) || signature (64)
 */
export interface StateUpdateMessage {
  /** Sender's compact identity (public key + key sequence). */
  readonly identity: CompactIdentity;
  /** Wire-format state data. */
  readonly stateData: StateWireData;
  /** ECDSA-P256-SHA256 signature over identity || stateData. */
  readonly signature: ECDSASignature;
}

// ─── Remote State Update ────────────────────────────────────────────

/**
 * A state update received from a bonded peer.
 */
export interface RemoteStateUpdate {
  /** NodeId of the broadcasting peer. */
  readonly peerId: NodeId;
  /** The peer's current state vector. */
  readonly state: NodeZeroState;
  /** Local reception timestamp. */
  readonly receivedAt: UnixTimestamp;
  /** Whether this peer is considered online (within TTL). */
  readonly availability: "ONLINE" | "OFFLINE";
}

// ─── State Callback ─────────────────────────────────────────────────

/**
 * Callback signature for state subscription.
 */
export type StateUpdateCallback = (update: RemoteStateUpdate) => void;
