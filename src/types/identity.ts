/**
 * @module types/identity
 * @description Identity Primitive — the cryptographic root of the Node Zero protocol.
 *
 * Identity is anchored in hardware (NXP SE050 secure element) or falls back
 * to WebCrypto. Enforces "One Device, One Self" via hardware-bound ECDSA P-256
 * keypairs where the private key never leaves the secure boundary.
 *
 * Conflict resolution: DeepSeek crypto details (P-256, compact format, attestation)
 * merged with Gemini data model structure (NodeZeroIdentity schema).
 */

import type {
  NodeId,
  CompressedPublicKey,
  ECDSASignature,
  KeySequence,
  UnixTimestamp,
} from "./branded.js";

// ─── Hardware Provider ──────────────────────────────────────────────

/**
 * The secure key storage provider.
 *
 * - `SE050`: NXP SE050 secure element (EAL 6+). Keys generated via hardware TRNG,
 *   never exposed to host CPU memory. Communication over I2C (T=1 protocol).
 * - `WEBCRYPTO`: Browser SubtleCrypto API with non-extractable CryptoKey objects.
 *   Subject to browser eviction — requires `navigator.storage.persist()`.
 */
export type HardwareProvider = "SE050" | "WEBCRYPTO";

/**
 * Identity recovery/migration status.
 *
 * - `active`: Current primary identity for this device.
 * - `migrated`: Superseded by a successor; read-only archival state.
 * - `deprecated`: Scheduled for deletion after migration grace period.
 */
export type IdentityStatus = "active" | "migrated" | "deprecated";

// ─── Identity Schema ────────────────────────────────────────────────

/**
 * The full identity data structure for a Node Zero instance.
 * Stored persistently in LittleFS (ESP32-S3) or IndexedDB (web).
 */
export interface NodeZeroIdentity {
  /** Schema version for forward-compatible lazy migration. */
  readonly version: number;

  /** Base58Check-encoded SHA-256 hash of the compressed public key. */
  readonly nodeId: NodeId;

  /** Cryptographic key material. */
  readonly publicKey: {
    /** 33-byte SEC1 compressed P-256 public key. */
    readonly data: CompressedPublicKey;
    /** Fixed: ECDSA on secp256r1 (NIST P-256). */
    readonly algorithm: "ECDSA-P256";
    /** SEC1 compressed encoding (0x02/0x03 prefix + 32-byte x-coordinate). */
    readonly encoding: "SEC1";
  };

  /** Hardware binding and key storage metadata. */
  readonly hardware: {
    /** The secure element or software provider hosting the private key. */
    readonly provider: HardwareProvider;
    /** Unique hardware identifier (ESP32-S3 chip ID or browser fingerprint). */
    readonly chipId: string;
    /** Whether the SE050 secure element is active and responsive. */
    readonly secureElementActive: boolean;
  };

  /**
   * Key rotation and successor handover state.
   * Follows DeepSeek's rotation certificate model with Gemini's lifecycle tracking.
   */
  readonly recovery: {
    /** 8-bit counter incremented on each rotation. Initial key = 0. */
    readonly keySequence: KeySequence;
    /** NodeId of the successor identity after migration, if any. */
    readonly successorNodeId?: NodeId;
    /** Signed proof of handover, verifiable by bonded peers. */
    readonly migrationCertificate?: Uint8Array;
    /** Current lifecycle phase. */
    readonly status: IdentityStatus;
  };

  /** Provisioning and rotation timestamps. */
  readonly metadata: {
    /** Unix timestamp of initial keypair generation (genesis event). */
    readonly provisionedAt: UnixTimestamp;
    /** Unix timestamp of most recent key rotation, if any. */
    readonly lastRotationAt?: UnixTimestamp;
  };
}

// ─── Compact Wire Format ────────────────────────────────────────────

/**
 * Compact identity for mesh transmission.
 * Total: 34 bytes — fits in any LoRa/BLE packet header.
 *
 * Layout: compressed_public_key (33 bytes) || key_seq (1 byte)
 */
export interface CompactIdentity {
  /** 33-byte compressed P-256 public key. */
  readonly publicKey: CompressedPublicKey;
  /** 8-bit key sequence counter. */
  readonly keySequence: KeySequence;
}

// ─── Attestation ────────────────────────────────────────────────────

/**
 * Self-signed attestation proving possession of the private key.
 * Used during initial pairing and challenge-response liveness proofs.
 *
 * Signed message = publicKey || deviceType || timestamp || nonce (if present).
 */
export interface IdentityAttestation {
  /** 33-byte compressed public key of the attesting node. */
  readonly publicKey: CompressedPublicKey;
  /** 0 = hardware (SE050), 1 = software (WebCrypto). */
  readonly deviceType: 0 | 1;
  /** Unix timestamp. Accept only within ±5 minutes for replay prevention. */
  readonly timestamp: UnixTimestamp;
  /** 32-byte random challenge for live verification. Zero/omitted for unsolicited. */
  readonly nonce?: Uint8Array;
  /** ECDSA signature over the concatenated fields. */
  readonly signature: ECDSASignature;
}

// ─── Rotation Certificate ───────────────────────────────────────────

/**
 * Rotation certificate binding an old key to a new key.
 * Signed by the OLD private key to prove continuity.
 *
 * Signed message = oldPublicKey || newPublicKey || newKeySeq || timestamp.
 */
export interface RotationCertificate {
  /** The outgoing (old) public key. */
  readonly oldPublicKey: CompressedPublicKey;
  /** The incoming (new) public key. */
  readonly newPublicKey: CompressedPublicKey;
  /** Must equal old keySeq + 1. */
  readonly newKeySequence: KeySequence;
  /** Unix timestamp of the rotation event. */
  readonly timestamp: UnixTimestamp;
  /** ECDSA signature by the old private key. */
  readonly signature: ECDSASignature;
}

// ─── Migration Certificate ──────────────────────────────────────────

/**
 * Migration certificate for device-to-device identity transfer.
 * The private key is exported from the SE050 encrypted under an
 * ephemeral ECDH-derived wrapping key (AES-256-GCM).
 */
export interface MigrationCertificate {
  /** The source identity being migrated. */
  readonly sourceNodeId: NodeId;
  /** Hardware attestation from the target device. */
  readonly targetDeviceAttestation: IdentityAttestation;
  /** AES-256-GCM IV (12 bytes). */
  readonly iv: Uint8Array;
  /** Encrypted private key scalar (32 bytes) + auth tag (16 bytes). */
  readonly encryptedKey: Uint8Array;
  /** Unix timestamp of the migration event. */
  readonly timestamp: UnixTimestamp;
}

// ─── Social Recovery ────────────────────────────────────────────────

/**
 * Recovery statement signed by a bonded peer.
 * M-of-N threshold required for social recovery.
 *
 * Signed message = oldPublicKey || newPublicKey || newKeySeq || timestamp || expiry.
 */
export interface RecoveryStatement {
  /** The lost identity's public key. */
  readonly oldPublicKey: CompressedPublicKey;
  /** The new replacement public key. */
  readonly newPublicKey: CompressedPublicKey;
  /** Fresh key sequence for the new identity. */
  readonly newKeySequence: KeySequence;
  /** Unix timestamp of the statement. */
  readonly timestamp: UnixTimestamp;
  /** Expiry timestamp (e.g., +7 days). Statement invalid after this. */
  readonly expiry: UnixTimestamp;
  /** ECDSA signature by the peer's key. */
  readonly signature: ECDSASignature;
  /** NodeId of the signing peer. */
  readonly peerId: NodeId;
}
