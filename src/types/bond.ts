/**
 * @module types/bond
 * @description Bond Primitive — the connection protocol between Identities.
 *
 * A Bond is a bidirectional, authenticated, encrypted channel between two
 * Node Zero instances. It manages trust negotiation, care score tracking,
 * and encrypted communication. Bonds evolve through four trust tiers
 * based on interaction frequency, reciprocity, and consistency.
 *
 * Conflict resolution: Gemini's trust tiers (GHOST/STRUT/COHERENT/RESONANT)
 * + Care Score model merged with DeepSeek's 5-phase negotiation protocol
 * and CBOR-encoded wire messages.
 */

import type {
  NodeId,
  CompressedPublicKey,
  SharedSecret,
  ECDSASignature,
  ChallengeNonce,
  Normalized,
  UnixTimestamp,
  LayerId,
} from "./branded.js";
import type { CompactIdentity } from "./identity.js";

// ─── Trust Tiers ────────────────────────────────────────────────────

/**
 * Bond trust levels governing visibility and vault access.
 *
 * - `GHOST`: Discovered via beacon; only public key and voltage visible.
 * - `STRUT`: Temporary connection request; shared secret established, Layer 0 only.
 * - `COHERENT`: Recognized relationship; full state vector, personal vault layers.
 * - `RESONANT`: High-care relationship; deep vault layers (legal, medical) open.
 */
export type TrustTier = "GHOST" | "STRUT" | "COHERENT" | "RESONANT";

/**
 * Bond lifecycle states per DeepSeek's protocol.
 *
 * - `PENDING`: One party initiated, awaiting response.
 * - `NEGOTIATING`: Challenge-response in progress.
 * - `ACTIVE`: Both parties completed negotiation.
 * - `TERMINATED`: Either party ended the bond (unilateral).
 * - `REJECTED`: Bond request explicitly denied.
 */
export type BondStatus =
  | "PENDING"
  | "NEGOTIATING"
  | "ACTIVE"
  | "TERMINATED"
  | "REJECTED";

/**
 * State visibility levels granted to a bonded peer.
 */
export type StateVisibility = "NONE" | "VOLTAGE" | "FULL_VECTOR";

// ─── Care Score Components ──────────────────────────────────────────

/**
 * Components used to compute the Care Score.
 * Updated daily using a 7-day sliding window.
 */
export interface CareScoreComponents {
  /**
   * Normalized interaction count per day.
   * Formula: min(1.0, (sent + recv) / (20 * 7))
   * Weight: 0.3
   */
  readonly frequency: Normalized;

  /**
   * Ratio of sent to received (balance of initiation).
   * Formula: min(1.0, min(sent, recv) / max(1, max(sent, recv)))
   * If total interactions < 3, defaults to 0.5.
   * Weight: 0.3
   */
  readonly reciprocity: Normalized;

  /**
   * Inverse of coefficient of variation of daily interaction counts.
   * Formula: 1.0 / (1.0 + stddev(daily) / (mean(daily) + 0.1))
   * Weight: 0.2
   */
  readonly consistency: Normalized;

  /**
   * Normalized inverse of average response time.
   * Formula: max(0, min(1.0, (60 - avgResponseTime) / 60))
   * Weight: 0.2
   */
  readonly responsiveness: Normalized;
}

// ─── Bond Record ────────────────────────────────────────────────────

/**
 * The full bond data structure stored locally per active connection.
 * Storage per bond: ~128 bytes (excluding care score history).
 */
export interface NodeZeroBond {
  /** Schema version for forward-compatible migration. */
  readonly version: number;

  /** Bonded partner identity. */
  readonly partner: {
    /** Partner's Node ID. */
    readonly nodeId: NodeId;
    /** Partner's compressed P-256 public key. */
    readonly publicKey: CompressedPublicKey;
    /** Partner's key sequence (updated on rotation). */
    readonly keySequence: number;
    /** Optional display name. */
    readonly displayName?: string;
  };

  /** Trust and care score tracking. */
  readonly trust: {
    /** Composite care score [0.0, 1.0]. */
    readonly careScore: Normalized;
    /** Individual care score components. */
    readonly components: CareScoreComponents;
    /** Active trust tier derived from care score thresholds. */
    readonly tier: TrustTier;
  };

  /** Encrypted communication channel. */
  readonly channel: {
    /** 32-byte ECDH-derived shared secret (via HKDF). */
    readonly sharedSecret: SharedSecret;
    /** Unix timestamp of last interaction. */
    readonly lastInteraction: UnixTimestamp;
    /** Total message exchanges since bond formation. */
    readonly totalExchanges: number;
    /** Current bond lifecycle state. */
    readonly status: BondStatus;
  };

  /** Access permissions granted to/from this peer. */
  readonly permissions: {
    /** Vault layers this peer can access. */
    readonly grantedVaultLayers: readonly LayerId[];
    /** How much of our state vector is visible to this peer. */
    readonly stateVisibility: StateVisibility;
  };

  /** Bond creation timestamp. */
  readonly createdAt: UnixTimestamp;
}

// ─── Negotiation Messages (CBOR-encoded) ────────────────────────────

/**
 * Phase 2, Message A1: Bond challenge (Initiator → Responder).
 * Begins mutual authentication.
 */
export interface BondChallenge {
  /** Sender's compact identity. */
  readonly senderIdentity: CompactIdentity;
  /** 32-byte random nonce. */
  readonly nonce: ChallengeNonce;
  /** Unix timestamp. */
  readonly timestamp: UnixTimestamp;
  /** ECDSA signature over the message (excluding signature field). */
  readonly signature: ECDSASignature;
}

/**
 * Phase 2, Message A2: Bond response (Responder → Initiator).
 * Echoes initiator nonce + provides responder nonce.
 */
export interface BondResponse {
  /** Responder's compact identity. */
  readonly senderIdentity: CompactIdentity;
  /** Initiator's compact identity (for binding). */
  readonly initiatorIdentity: CompactIdentity;
  /** Responder's 32-byte random nonce. */
  readonly responderNonce: ChallengeNonce;
  /** Echoed nonce from the challenge message. */
  readonly initiatorNonce: ChallengeNonce;
  /** ECDSA signature over the full message. */
  readonly signature: ECDSASignature;
}

/**
 * Phase 2, Message A3: Bond confirm (Initiator → Responder).
 * Proves initiator can sign; echoes responder nonce.
 */
export interface BondConfirm {
  /** Initiator's compact identity. */
  readonly senderIdentity: CompactIdentity;
  /** Responder's compact identity. */
  readonly responderIdentity: CompactIdentity;
  /** Echoed responder nonce from A2. */
  readonly responderNonce: ChallengeNonce;
  /** ECDSA signature over the full message. */
  readonly signature: ECDSASignature;
}

/**
 * Phase 4: Trust negotiation (bidirectional).
 * Exchanged after mutual authentication to configure access.
 */
export interface BondTrustNegotiation {
  /** Sender's compact identity. */
  readonly senderIdentity: CompactIdentity;
  /** Target's compact identity. */
  readonly targetIdentity: CompactIdentity;
  /** Bitmask of initially shared vault layers. */
  readonly layers: number;
  /** State visibility preference. */
  readonly visibilityPrefs: StateVisibility;
  /** ECDSA signature. */
  readonly signature: ECDSASignature;
}

/**
 * Bond termination message (unilateral).
 */
export interface BondTerminate {
  /** Sender's compact identity. */
  readonly senderIdentity: CompactIdentity;
  /** Target identity being terminated. */
  readonly targetIdentity: CompactIdentity;
  /** Reason code: 0 = user, 1 = compromise. */
  readonly reason: number;
  /** Unix timestamp. */
  readonly timestamp: UnixTimestamp;
  /** ECDSA signature. */
  readonly signature: ECDSASignature;
}

// ─── Bond Wire Format ───────────────────────────────────────────────

/**
 * Bond handshake packet for mesh transmission.
 *
 * | Offset | Field      | Size | Description                    |
 * |--------|------------|------|--------------------------------|
 * | 0      | packetType | 1    | 0x02 for Bond                  |
 * | 1      | subType    | 1    | 0x01 = Beacon, 0x02 = Challenge|
 * | 2–34   | pubKey     | 33   | Compressed P-256 public key    |
 * | 35–38  | qValue     | 4    | Q coherence from Trimtab       |
 * | 39–42  | CRC        | 4    | Packet integrity check         |
 */
export interface BondHandshakePacket {
  /** Fixed: 0x02. */
  readonly packetType: 0x02;
  /** Sub-type: beacon, challenge, response, confirm, trust, terminate. */
  readonly subType: number;
  /** Sender's compressed public key. */
  readonly publicKey: CompressedPublicKey;
  /** Q coherence tuning value. */
  readonly qValue: number;
  /** CRC-32 integrity check. */
  readonly crc: number;
}

// ─── Bond Message ───────────────────────────────────────────────────

/**
 * A typed message sent over an active bond channel.
 * Encrypted with the bond's shared secret before transmission.
 */
export interface BondMessage {
  /** Message type discriminator. */
  readonly type:
    | "STATE_UPDATE"
    | "VAULT_REQUEST"
    | "VAULT_GRANT"
    | "VAULT_FRAGMENT"
    | "PING"
    | "CUSTOM";
  /** Serialized message payload. */
  readonly payload: Uint8Array;
  /** Unix timestamp. */
  readonly timestamp: UnixTimestamp;
  /** Sender NodeId. */
  readonly senderId: NodeId;
}

/**
 * Callback signature for bond message reception.
 */
export type MessageCallback = (message: BondMessage) => void;

// ─── Care Score Decay ───────────────────────────────────────────────

/**
 * Configuration for care score exponential decay.
 * CS(t) = CS(0) * e^(-λt) where λ = ln(2) / halfLife.
 */
export interface CareScoreDecayConfig {
  /** Half-life in days (default: 14). */
  readonly halfLifeDays: number;
  /** Minimum score before bond reverts to lower tier. */
  readonly minimumThreshold: Normalized;
}

// ─── Trust Tier Thresholds ──────────────────────────────────────────

/**
 * Care score thresholds for trust tier transitions.
 */
export interface TrustTierThresholds {
  /** Minimum care score for STRUT tier. */
  readonly strut: Normalized;
  /** Minimum care score for COHERENT tier. */
  readonly coherent: Normalized;
  /** Minimum care score for RESONANT tier. */
  readonly resonant: Normalized;
}
