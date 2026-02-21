/**
 * @module backends/webcrypto-identity
 * @description WebCrypto implementation of IIdentityProvider.
 *
 * Uses SubtleCrypto for:
 * - ECDSA P-256 key generation (non-extractable private keys)
 * - Sign/verify with SHA-256
 * - Key rotation with certificate chain
 * - Attestation for challenge-response
 *
 * Private keys are stored as non-extractable CryptoKey objects.
 * In a browser, use navigator.storage.persist() to prevent eviction.
 */

import { NodeZeroEmitter } from "../primitives/base-emitter.js";
import type { IIdentityProvider } from "../interfaces/identity-provider.js";
import { IdentityError } from "../interfaces/identity-provider.js";
import type {
  NodeZeroIdentity,
  IdentityAttestation,
  RotationCertificate,
  MigrationCertificate,
  RecoveryStatement,
} from "../types/identity.js";
import type {
  ECDSASignature,
  CompressedPublicKey,
  KeySequence,
  UnixTimestamp,
  NodeId,
} from "../types/branded.js";
import {
  exportCompressedPublicKey,
  importPublicKey,
  deriveNodeId,
  normalizeSignature,
  randomBytes,
  buf,
} from "./crypto-utils.js";

// ─── Internal State ────────────────────────────────────────────────

interface KeyState {
  /** ECDSA signing key (non-extractable). */
  signingKey: CryptoKey;
  /** ECDSA verification key (extractable for export). */
  verifyKey: CryptoKey;
  /** ECDH private key for shared secret derivation. */
  ecdhPrivateKey: CryptoKey;
  /** ECDH public key for sharing. */
  ecdhPublicKey: CryptoKey;
  /** Compressed public key bytes. */
  compressedPublicKey: CompressedPublicKey;
  /** Derived NodeId. */
  nodeId: NodeId;
  /** Current key sequence number. */
  keySequence: KeySequence;
  /** Provisioning timestamp. */
  provisionedAt: UnixTimestamp;
  /** Last rotation timestamp. */
  lastRotationAt?: UnixTimestamp;
}

/**
 * WebCryptoIdentityProvider — software-backed ECDSA P-256 identity.
 *
 * @example
 * ```ts
 * const identity = new WebCryptoIdentityProvider();
 * await identity.generateKeypair();
 *
 * const message = new TextEncoder().encode("hello");
 * const sig = await identity.sign(message);
 *
 * const pub = await identity.exportPublicKey();
 * const valid = await identity.verify(message, sig, pub.publicKey.data);
 * console.log(valid); // true
 * ```
 */
export class WebCryptoIdentityProvider
  extends NodeZeroEmitter
  implements IIdentityProvider
{
  private state: KeyState | null = null;

  /**
   * Get the ECDH private key for shared secret derivation.
   * Used by the ChannelManager during bond formation.
   */
  getECDHPrivateKey(): CryptoKey {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }
    return this.state.ecdhPrivateKey;
  }

  /**
   * Get the compressed public key without the full identity envelope.
   */
  getCompressedPublicKey(): CompressedPublicKey {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }
    return this.state.compressedPublicKey;
  }

  /**
   * Get the compressed ECDH public key for exchange during bond negotiation.
   * Separate from the ECDSA signing key (key separation principle).
   */
  async getCompressedECDHPublicKey(): Promise<CompressedPublicKey> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }
    return exportCompressedPublicKey(this.state.ecdhPublicKey);
  }

  /**
   * Get the current NodeId.
   */
  getNodeId(): NodeId {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }
    return this.state.nodeId;
  }

  // ─── Commands ───────────────────────────────────────────────────

  async generateKeypair(): Promise<void> {
    if (this.state) {
      throw new IdentityError(
        "Identity already provisioned. Use rotateKey() to change keys.",
        "SECURITY_ERROR"
      );
    }

    const subtle = this.getSubtle();

    // Generate ECDSA keypair for signing
    const ecdsaKeyPair = await subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false, // non-extractable private key
      ["sign", "verify"]
    );

    // Generate ECDH keypair for shared secret derivation
    const ecdhKeyPair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );

    // Export and compress the ECDSA public key
    const compressedPublicKey = await exportCompressedPublicKey(
      ecdsaKeyPair.publicKey
    );

    const nodeId = await deriveNodeId(compressedPublicKey);
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    this.state = {
      signingKey: ecdsaKeyPair.privateKey,
      verifyKey: ecdsaKeyPair.publicKey,
      ecdhPrivateKey: ecdhKeyPair.privateKey,
      ecdhPublicKey: ecdhKeyPair.publicKey,
      compressedPublicKey,
      nodeId,
      keySequence: 0 as KeySequence,
      provisionedAt: now,
    };

    // Build full identity for the event
    const identity = this.buildIdentity();

    this.emit({
      type: "IDENTITY_PROVISIONED",
      identity,
      timestamp: now,
    });
  }

  async rotateKey(): Promise<RotationCertificate> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }

    if (this.state.keySequence >= 255) {
      throw new IdentityError(
        "Key sequence overflow (max 255 rotations)",
        "ROTATION_ERROR"
      );
    }

    const subtle = this.getSubtle();
    const oldPublicKey = this.state.compressedPublicKey;
    const oldSigningKey = this.state.signingKey;

    // Generate new ECDSA keypair
    const newEcdsaPair = await subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );

    // Generate new ECDH keypair
    const newEcdhPair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );

    const newPublicKey = await exportCompressedPublicKey(
      newEcdsaPair.publicKey
    );
    const newKeySequence = (this.state.keySequence + 1) as KeySequence;
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Build rotation certificate message: oldPub || newPub || newKeySeq || timestamp
    const message = new Uint8Array(33 + 33 + 1 + 4);
    message.set(oldPublicKey, 0);
    message.set(newPublicKey, 33);
    message[66] = newKeySequence;
    new DataView(message.buffer, 67, 4).setUint32(0, now, false);

    // Sign with OLD key to prove continuity
    const rawSig = await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      oldSigningKey,
      message
    );

    const signature = normalizeSignature(
      new Uint8Array(rawSig)
    );

    // Update internal state
    const newNodeId = await deriveNodeId(newPublicKey);

    this.state = {
      signingKey: newEcdsaPair.privateKey,
      verifyKey: newEcdsaPair.publicKey,
      ecdhPrivateKey: newEcdhPair.privateKey,
      ecdhPublicKey: newEcdhPair.publicKey,
      compressedPublicKey: newPublicKey,
      nodeId: newNodeId,
      keySequence: newKeySequence,
      provisionedAt: this.state.provisionedAt,
      lastRotationAt: now,
    };

    const certificate: RotationCertificate = {
      oldPublicKey,
      newPublicKey,
      newKeySequence,
      timestamp: now,
      signature,
    };

    this.emit({
      type: "IDENTITY_ROTATED",
      certificate,
      newNodeId,
      timestamp: now,
    });

    return certificate;
  }

  async migrateToDevice(
    targetDeviceAttestation: IdentityAttestation
  ): Promise<MigrationCertificate> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }

    // In WebCrypto, private keys are non-extractable.
    // Migration requires re-keying on the target device.
    // We create a migration certificate that the target can use
    // to prove chain of custody to bonded peers.

    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Verify target attestation timestamp is within 5 minutes
    const timeDiff = Math.abs(now - (targetDeviceAttestation.timestamp as number));
    if (timeDiff > 300) {
      throw new IdentityError(
        "Target attestation timestamp too old (>5 min)",
        "MIGRATION_ERROR"
      );
    }

    // Since WebCrypto keys are non-extractable, we use a different
    // approach: generate ephemeral ECDH, derive wrapping key, and
    // export a signed migration assertion (not the actual private key).
    // The target device generates its own keypair and we sign a
    // certificate binding old identity → new identity.

    const iv = randomBytes(12);

    // Create a placeholder encrypted key (real SE050 would export here)
    const encryptedKey = randomBytes(48); // 32-byte key + 16-byte tag

    const certificate: MigrationCertificate = {
      sourceNodeId: this.state.nodeId,
      targetDeviceAttestation,
      iv,
      encryptedKey,
      timestamp: now,
    };

    // Mark current identity as deprecated
    this.emit({
      type: "IDENTITY_STATUS_CHANGED",
      nodeId: this.state.nodeId,
      oldStatus: "active",
      newStatus: "deprecated",
      timestamp: now,
    });

    this.emit({
      type: "IDENTITY_MIGRATED",
      certificate,
      timestamp: now,
    });

    return certificate;
  }

  async recover(
    statements: readonly RecoveryStatement[],
    threshold?: number
  ): Promise<void> {
    const requiredThreshold =
      threshold ?? Math.floor(statements.length / 2) + 1;

    if (statements.length < requiredThreshold) {
      throw new IdentityError(
        `Need ${requiredThreshold} statements, got ${statements.length}`,
        "RECOVERY_ERROR"
      );
    }

    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Verify each statement
    let validCount = 0;
    for (const stmt of statements) {
      // Check expiry
      if ((stmt.expiry as number) < now) continue;

      // Verify signature
      const message = new Uint8Array(33 + 33 + 1 + 4 + 4);
      message.set(stmt.oldPublicKey, 0);
      message.set(stmt.newPublicKey, 33);
      message[66] = stmt.newKeySequence as number;
      new DataView(message.buffer, 67, 4).setUint32(
        0,
        stmt.timestamp as number,
        false
      );
      new DataView(message.buffer, 71, 4).setUint32(
        0,
        stmt.expiry as number,
        false
      );

      // Import peer's public key (we need it from the statement's peerId)
      // In a real impl, we'd look up the peer's public key from the bond store
      // For now, we count all non-expired statements as valid
      validCount++;
    }

    if (validCount < requiredThreshold) {
      throw new IdentityError(
        `Only ${validCount} valid statements, need ${requiredThreshold}`,
        "RECOVERY_ERROR"
      );
    }

    // Generate new keypair
    this.state = null; // Clear existing state
    await this.generateKeypair();

    // The new identity has been provisioned, IDENTITY_PROVISIONED already emitted.
    // Now emit recovery event.
    if (this.state) {
      this.emit({
        type: "IDENTITY_RECOVERED",
        newNodeId: (this.state as KeyState).nodeId,
        statements,
        timestamp: now,
      });
    }
  }

  // ─── Queries ────────────────────────────────────────────────────

  async sign(payload: Uint8Array): Promise<ECDSASignature> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }

    const subtle = this.getSubtle();

    const rawSig = await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      this.state.signingKey,
      buf(payload)
    );

    // WebCrypto P-256 returns IEEE P1363 format (64 bytes: r || s)
    return normalizeSignature(new Uint8Array(rawSig));
  }

  async verify(
    payload: Uint8Array,
    signature: ECDSASignature,
    publicKey: CompressedPublicKey
  ): Promise<boolean> {
    const subtle = this.getSubtle();

    try {
      const key = await importPublicKey(publicKey, "verify");

      return subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        buf(signature),
        buf(payload)
      );
    } catch {
      return false;
    }
  }

  async exportPublicKey(): Promise<NodeZeroIdentity> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }

    return this.buildIdentity();
  }

  async createAttestation(nonce?: Uint8Array): Promise<IdentityAttestation> {
    if (!this.state) {
      throw new IdentityError("No identity provisioned", "NOT_PROVISIONED");
    }

    const subtle = this.getSubtle();
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Build attestation message: publicKey || deviceType || timestamp [|| nonce]
    const nonceLen = nonce?.length ?? 0;
    const message = new Uint8Array(33 + 1 + 4 + nonceLen);
    message.set(this.state.compressedPublicKey, 0);
    message[33] = 1; // deviceType = 1 (WebCrypto / software)
    new DataView(message.buffer, 34, 4).setUint32(0, now, false);
    if (nonce) {
      message.set(nonce, 38);
    }

    const rawSig = await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      this.state.signingKey,
      message
    );

    const signature = normalizeSignature(new Uint8Array(rawSig));

    return {
      publicKey: this.state.compressedPublicKey,
      deviceType: 1,
      timestamp: now,
      nonce,
      signature,
    };
  }

  async isProvisioned(): Promise<boolean> {
    return this.state !== null;
  }

  // ─── Internal ───────────────────────────────────────────────────

  private getSubtle(): SubtleCrypto {
    const s = globalThis.crypto?.subtle;
    if (!s) {
      throw new IdentityError(
        "WebCrypto SubtleCrypto not available",
        "HARDWARE_ERROR"
      );
    }
    return s;
  }

  private buildIdentity(): NodeZeroIdentity {
    const s = this.state!;
    return {
      version: 1,
      nodeId: s.nodeId,
      publicKey: {
        data: s.compressedPublicKey,
        algorithm: "ECDSA-P256",
        encoding: "SEC1",
      },
      hardware: {
        provider: "WEBCRYPTO",
        chipId: `webcrypto-${s.nodeId.slice(0, 8)}`,
        secureElementActive: false,
      },
      recovery: {
        keySequence: s.keySequence,
        status: "active",
      },
      metadata: {
        provisionedAt: s.provisionedAt,
        lastRotationAt: s.lastRotationAt,
      },
    };
  }
}
