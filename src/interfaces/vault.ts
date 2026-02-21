/**
 * @module interfaces/vault
 * @description IVault — capability-based data layering with envelope encryption.
 *
 * Provides layered, encrypted storage with UCAN-based access control.
 * Supports fragmentation for constrained transports (LoRa) and Merkle
 * tree synchronization for multi-device coordination.
 *
 * Storage: Dexie.js/IndexedDB (web) or LittleFS (ESP32-S3).
 * Encryption: AES-256-GCM with per-layer DEKs, wrapped via ECDH + HKDF.
 */

import type {
  NodeZeroVaultLayer,
  LayerMetadata,
  SchemaDefinition,
  ExportFormat,
  VaultMerkleNode,
} from "../types/vault.js";
import type { NodeId, LayerId, UCANToken } from "../types/branded.js";

/**
 * Errors that may be thrown by IVault operations.
 */
export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "LAYER_EXISTS"
      | "LAYER_NOT_FOUND"
      | "SCHEMA_MISMATCH"
      | "ACCESS_DENIED"
      | "TOKEN_EXPIRED"
      | "TOKEN_REVOKED"
      | "CAPACITY_EXCEEDED"
      | "ENCRYPTION_ERROR"
      | "SYNC_CONFLICT"
  ) {
    super(message);
    this.name = "VaultError";
  }
}

/**
 * @interface IVault
 * @description Provides layered, encrypted storage with capability-based
 * access control. Supports fragmentation for constrained transports.
 */
export interface IVault {
  // ─── Commands ───────────────────────────────────────────────────

  /**
   * @command
   * @description Defines a new permission layer with an associated schema.
   *
   * Generates a fresh AES-256-GCM DEK for the layer, wraps it with
   * the owner's public key, and persists the layer metadata.
   *
   * @param name - Human-readable layer name (e.g., "medical", "legal").
   * @param schema - The structure of data objects stored in this layer.
   * @postcondition Layer metadata persisted; encryption keys initialized.
   *               Emits VAULT_LAYER_CREATED event.
   * @throws {VaultError} code=LAYER_EXISTS if a layer with this name exists.
   */
  createLayer(name: string, schema: SchemaDefinition): Promise<void>;

  /**
   * @command
   * @description Encrypts and writes data to a specific layer.
   *
   * Uses the layer's DEK (unwrapped via owner's private key) to encrypt
   * the data with AES-256-GCM and a fresh random IV.
   *
   * @param layerName - The target layer.
   * @param data - The data object to store (must conform to layer schema).
   * @postcondition Emits VAULT_LAYER_WRITTEN event.
   *               May emit VAULT_CAPACITY_WARNING if > 70% used.
   * @throws {VaultError} code=LAYER_NOT_FOUND if layer doesn't exist.
   * @throws {VaultError} code=SCHEMA_MISMATCH if data violates layer schema.
   * @throws {VaultError} code=CAPACITY_EXCEEDED if storage is full.
   */
  write(layerName: string, data: Record<string, unknown>): Promise<void>;

  /**
   * @command
   * @description Generates a UCAN token granting a bonded identity
   * access to a specific vault layer.
   *
   * Unwraps the layer DEK using the owner's private key, then re-wraps
   * it with the recipient's public key. The wrapped key and UCAN token
   * are added to the layer's ACL.
   *
   * UCAN structure:
   * - iss: did:key of the granting node
   * - aud: did:key of the bonded peer
   * - att: [{ with: "vault://{layerName}", can: "layer/read" }]
   * - prf: proof chain to root hardware identity
   *
   * @param layerName - The layer for which access is granted.
   * @param bondId - The NodeId of the identity receiving access.
   * @returns An attenuated UCAN capability token.
   * @postcondition Grant recorded in the local capability registry.
   *               Emits VAULT_ACCESS_GRANTED event.
   * @throws {VaultError} code=LAYER_NOT_FOUND if layer doesn't exist.
   */
  grantAccess(layerName: string, bondId: NodeId): Promise<UCANToken>;

  /**
   * @command
   * @description Revokes a previously granted access token.
   *
   * Removes the partner's wrapped DEK from the layer's ACL. The partner
   * can no longer decrypt new data (though cached data may persist on
   * their device until the next key rotation).
   *
   * @param layerName - The layer associated with the token.
   * @param bondId - The identity whose access is being removed.
   * @postcondition Emits VAULT_ACCESS_REVOKED event.
   * @throws {VaultError} code=LAYER_NOT_FOUND if layer doesn't exist.
   */
  revokeAccess(layerName: string, bondId: NodeId): Promise<void>;

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * @query
   * @description Retrieves and decrypts data from a layer using a valid UCAN.
   *
   * The token's proof chain is verified locally against the capability
   * registry. If valid, the DEK is unwrapped and used to decrypt the data.
   *
   * @param layerName - The target layer.
   * @param accessToken - A base64-encoded UCAN capability token.
   * @returns The decrypted data object.
   * @throws {VaultError} code=ACCESS_DENIED if token is insufficient.
   * @throws {VaultError} code=TOKEN_EXPIRED if token has expired.
   * @throws {VaultError} code=TOKEN_REVOKED if token was revoked.
   */
  read(
    layerName: string,
    accessToken: UCANToken
  ): Promise<Record<string, unknown>>;

  /**
   * @query
   * @description Returns metadata for all layers the node manages.
   *
   * @returns Array of layer names, schemas, ACL counts, sizes.
   */
  listLayers(): Promise<readonly LayerMetadata[]>;

  /**
   * @query
   * @description Exports the entire vault structure as an encrypted blob.
   *
   * @param format - Serialization format (CAR, JSON, BINARY).
   * @returns The serialized vault.
   */
  export(format: ExportFormat): Promise<Uint8Array>;

  /**
   * @query
   * @description Computes the Merkle tree for vault synchronization.
   *
   * Each layer is a leaf node. Devices exchange root hashes to find
   * which specific layers need updating (Delta Sync).
   *
   * @returns The root node of the vault's Merkle tree.
   */
  getMerkleRoot(): Promise<VaultMerkleNode>;

  /**
   * @query
   * @description Returns current storage usage metrics.
   *
   * @returns Used bytes, total bytes, and percentage.
   */
  getStorageUsage(): Promise<{
    usedBytes: number;
    totalBytes: number;
    percentage: number;
  }>;
}
