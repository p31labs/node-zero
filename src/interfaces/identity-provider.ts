/**
 * @module interfaces/identity-provider
 * @description IIdentityProvider — the cryptographic root of trust.
 *
 * Manages the full lifecycle of the NodeId: generation, signing,
 * verification, key rotation, device migration, and social recovery.
 * All implementations must ensure the private key remains non-extractable.
 *
 * Follows Command/Query Separation (CQS):
 * - Commands mutate state (generateKeypair, migrateToDevice, rotateKey, recover)
 * - Queries return data without side effects (sign, verify, exportPublicKey)
 *
 * Note: `sign` is classified as a query despite being a cryptographic operation,
 * because it does not mutate the identity's state.
 */

import type { NodeZeroIdentity, IdentityAttestation, RotationCertificate, MigrationCertificate, RecoveryStatement } from "../types/identity.js";
import type { ECDSASignature, CompressedPublicKey } from "../types/branded.js";

/**
 * Errors that may be thrown by IIdentityProvider operations.
 */
export class IdentityError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "HARDWARE_ERROR"
      | "SECURITY_ERROR"
      | "NOT_PROVISIONED"
      | "MIGRATION_ERROR"
      | "RECOVERY_ERROR"
      | "ROTATION_ERROR"
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

/**
 * @interface IIdentityProvider
 * @description The cryptographic root of trust for a Node Zero instance.
 *
 * Manages ECDSA P-256 keypairs bound to hardware (SE050) or software (WebCrypto).
 * Enforces "One Device, One Self" — a single active identity per hardware instance.
 */
export interface IIdentityProvider {
  // ─── Commands ───────────────────────────────────────────────────

  /**
   * @command
   * @description Generates a new ECDSA P-256 keypair within the secure element.
   * This is the "Genesis" event for a Node Zero instance.
   *
   * On SE050: Uses hardware TRNG (NIST SP800-90B) for entropy.
   * On WebCrypto: Uses `crypto.getRandomValues()` with non-extractable keys.
   *
   * @precondition Secure hardware is initialized or WebCrypto is available.
   * @postcondition A new NodeId is generated; emits IDENTITY_PROVISIONED event.
   * @throws {IdentityError} code=HARDWARE_ERROR if TRNG fails or SE050 unresponsive.
   * @throws {IdentityError} code=SECURITY_ERROR if overwriting an active identity.
   */
  generateKeypair(): Promise<void>;

  /**
   * @command
   * @description Rotates to a new keypair, creating a RotationCertificate
   * signed by the current (old) private key to prove continuity.
   *
   * @precondition Active identity exists with keySequence < 255.
   * @postcondition New keypair is active; old keypair enters deprecated state.
   *               Rotation certificate broadcast to bonded peers.
   * @throws {IdentityError} code=NOT_PROVISIONED if no identity exists.
   * @throws {IdentityError} code=ROTATION_ERROR if key sequence overflow.
   */
  rotateKey(): Promise<RotationCertificate>;

  /**
   * @command
   * @description Executes the successor handover protocol for device migration.
   *
   * 1. Both devices perform ECDH with ephemeral keys.
   * 2. Derive wrapping key via HKDF.
   * 3. SE050 exports private key encrypted under wrapping key.
   * 4. Target device imports and stores the private key.
   *
   * @param targetDeviceAttestation - Hardware attestation from the new device.
   * @returns Signed migration certificate for broadcast to bonded peers.
   * @postcondition Current identity enters DEPRECATED status.
   * @throws {IdentityError} code=MIGRATION_ERROR if target attestation fails.
   */
  migrateToDevice(
    targetDeviceAttestation: IdentityAttestation
  ): Promise<MigrationCertificate>;

  /**
   * @command
   * @description Recovers identity using M-of-N social recovery.
   *
   * @param statements - Array of signed recovery statements from bonded peers.
   * @param threshold - Minimum number of valid statements required (default: floor(N/2)+1).
   * @precondition The new keypair has been generated on the replacement device.
   * @postcondition New identity is accepted; old identity marked as recovered.
   * @throws {IdentityError} code=RECOVERY_ERROR if threshold not met.
   */
  recover(
    statements: readonly RecoveryStatement[],
    threshold?: number
  ): Promise<void>;

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * @query
   * @description Produces an ECDSA-P256-SHA256 signature for a given payload.
   *
   * @param payload - The data to be signed.
   * @returns A 64-byte ECDSA signature (r || s, big-endian).
   * @throws {IdentityError} code=NOT_PROVISIONED if no identity exists.
   */
  sign(payload: Uint8Array): Promise<ECDSASignature>;

  /**
   * @query
   * @description Verifies a signature against a payload and public key.
   * Enables offline verification of peer identities.
   *
   * @param payload - The original data that was signed.
   * @param signature - The ECDSA signature to verify.
   * @param publicKey - The 33-byte compressed P-256 public key.
   * @returns True if the signature is cryptographically valid.
   */
  verify(
    payload: Uint8Array,
    signature: ECDSASignature,
    publicKey: CompressedPublicKey
  ): Promise<boolean>;

  /**
   * @query
   * @description Returns the full shareable public identity object.
   *
   * @returns The NodeZeroIdentity (public key, hardware metadata, status).
   * @throws {IdentityError} code=NOT_PROVISIONED if no identity exists.
   */
  exportPublicKey(): Promise<NodeZeroIdentity>;

  /**
   * @query
   * @description Creates a self-signed attestation for challenge-response.
   *
   * @param nonce - Optional 32-byte challenge for live verification.
   * @returns Signed attestation containing public key, device type, timestamp.
   */
  createAttestation(nonce?: Uint8Array): Promise<IdentityAttestation>;

  /**
   * @query
   * @description Checks whether an identity has been provisioned.
   * @returns True if a keypair exists on this device.
   */
  isProvisioned(): Promise<boolean>;
}
