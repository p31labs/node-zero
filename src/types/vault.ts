/**
 * @module types/vault
 * @description Vault Primitive — tiered, permission-gated knowledge store.
 *
 * The Vault is the "digital brain" housing everything from medical history
 * to professional credentials. It implements envelope encryption: each layer
 * is encrypted with a unique AES-256-GCM DEK, which is itself wrapped with
 * the owner's public key. Access grants re-wrap the DEK with the recipient's
 * public key for offline-first coordination.
 *
 * Conflict resolution: Gemini's layered structure + ACL model merged with
 * DeepSeek's HKDF-based key derivation and Gemini's UCAN capability tokens.
 */

import type {
  NodeId,
  WrappedDEK,
  EncryptedBlob,
  AESNonce,
  AuthTag,
  UCANToken,
  LayerId,
  UnixTimestamp,
} from "./branded.js";

// ─── Standard Layers ────────────────────────────────────────────────

/**
 * Recommended standardized vault layers for interoperability.
 * Owners can define additional custom layers.
 */
export type StandardLayer =
  | "REFLEX"        // Layer 0: Critical emergency data (blood type, allergies)
  | "IDENTITY"      // Layer 1: Official documents (ID, passport, legal)
  | "MEMORY"        // Layer 2: Personal logs and historical state data
  | "PROFESSIONAL"  // Layer 3: Work credentials and communication logs
  | "PLAYFUL";      // Layer 4: Social preferences, hobby data, game state

// ─── Vault Permissions ──────────────────────────────────────────────

/**
 * Access permission levels for vault layers.
 */
export type VaultPermission = "READ" | "WRITE" | "ADMIN";

// ─── Export Formats ─────────────────────────────────────────────────

/**
 * Supported vault export serialization formats.
 */
export type ExportFormat = "CAR" | "JSON" | "BINARY";

// ─── ACL Entry ──────────────────────────────────────────────────────

/**
 * An Access Control List entry for a bonded identity.
 * The DEK is re-wrapped with the partner's public key so they can
 * independently decrypt the layer offline.
 */
export interface VaultACLEntry {
  /** NodeId of the bonded partner. */
  readonly partnerId: NodeId;
  /** The layer DEK wrapped with the partner's public key. */
  readonly partnerWrappedKey: WrappedDEK;
  /** Maximum permission level granted. */
  readonly permissions: VaultPermission;
  /** UCAN capability token for this grant. */
  readonly capabilityToken?: UCANToken;
  /** Expiry timestamp for this grant. Undefined = no expiry. */
  readonly expiresAt?: UnixTimestamp;
}

// ─── Vault Layer ────────────────────────────────────────────────────

/**
 * A single encrypted layer within the Vault.
 * Each layer is independently encrypted with its own DEK.
 */
export interface NodeZeroVaultLayer {
  /** Schema version for lazy migration. */
  readonly version: number;
  /** Human-readable layer identifier. */
  readonly id: LayerId;

  /** AES-256-GCM encryption parameters. */
  readonly encryption: {
    /** Fixed: AES-256-GCM. */
    readonly algorithm: "AES-256-GCM";
    /** 12-byte initialization vector. */
    readonly nonce: AESNonce;
    /** 16-byte authentication tag. */
    readonly authTag: AuthTag;
  };

  /** Key management. */
  readonly keys: {
    /** DEK wrapped with the owner's public key. */
    readonly ownerWrappedKey: WrappedDEK;
    /** Access grants for bonded identities. */
    readonly acl: readonly VaultACLEntry[];
  };

  /** Encrypted payload. */
  readonly content: {
    /** AES-256-GCM ciphertext. */
    readonly ciphertext: EncryptedBlob;
    /** Unix timestamp of last modification. */
    readonly lastModified: UnixTimestamp;
    /** SHA-256 checksum of plaintext content for sync verification. */
    readonly checksum: string;
  };
}

// ─── Layer Metadata ─────────────────────────────────────────────────

/**
 * Metadata for a vault layer (returned by listLayers).
 * Does not include encrypted content.
 */
export interface LayerMetadata {
  /** Layer identifier. */
  readonly id: LayerId;
  /** Schema definition for the layer's data objects. */
  readonly schema: Record<string, unknown>;
  /** Number of ACL entries. */
  readonly aclCount: number;
  /** Last modification timestamp. */
  readonly lastModified: UnixTimestamp;
  /** Approximate size in bytes. */
  readonly sizeBytes: number;
}

// ─── Vault Fragment (Wire Format) ───────────────────────────────────

/**
 * Vault layer fragment for LoRa mesh transmission (≤256 bytes).
 *
 * | Offset | Field      | Size | Description                          |
 * |--------|------------|------|--------------------------------------|
 * | 0      | packetType | 1    | 0x03 for Vault                       |
 * | 1      | layerId    | 1    | 0–255 layer index                    |
 * | 2–3    | seqNum     | 2    | Fragment index / total fragments      |
 * | 4–255  | payload    | 252  | Encrypted DEK or ciphertext segment   |
 */
export interface VaultFragment {
  /** Fixed: 0x03. */
  readonly packetType: 0x03;
  /** Layer index (0–255). */
  readonly layerIndex: number;
  /** Fragment sequence: { current, total }. */
  readonly sequence: {
    readonly current: number;
    readonly total: number;
  };
  /** Encrypted payload segment (up to 252 bytes). */
  readonly payload: Uint8Array;
}

// ─── Schema Definition ──────────────────────────────────────────────

/**
 * A schema definition for vault layer data objects.
 * Uses a simplified JSON Schema subset.
 */
export type SchemaDefinition = Record<string, unknown>;

// ─── Merkle Sync ────────────────────────────────────────────────────

/**
 * Merkle tree node for efficient vault synchronization.
 * Each layer is a leaf; devices exchange root hashes to find diffs.
 */
export interface VaultMerkleNode {
  /** Layer ID (leaf) or computed hash (internal node). */
  readonly id: string;
  /** SHA-256 hash of this node's content/children. */
  readonly hash: string;
  /** Child nodes (empty for leaves). */
  readonly children: readonly VaultMerkleNode[];
}
