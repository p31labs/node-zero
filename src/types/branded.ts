/**
 * @module types/branded
 * @description Branded types for compile-time safety across the Node Zero protocol.
 *
 * Branded types prevent accidental misuse of raw primitives (strings, numbers,
 * Uint8Arrays) as protocol-level identifiers. A raw string can never be parsed
 * as a NodeId, and a raw Uint8Array can never be treated as an EncryptedBlob,
 * stopping injection and type-confusion vulnerabilities at the compiler level.
 *
 * @example
 * ```ts
 * const raw = "some-string";
 * // Type error: string is not assignable to NodeId
 * const id: NodeId = raw;
 * // Correct:
 * const id: NodeId = createNodeId(publicKeyBytes);
 * ```
 */

/** Unique symbol for branding. Not exported — internal only. */
declare const __brand: unique symbol;

/**
 * Generic branded type utility.
 * Intersects a base type with a phantom brand field that exists only
 * at the type level, never at runtime.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ─── Identity Brands ────────────────────────────────────────────────

/**
 * A Base58Check-encoded SHA-256 hash of a compressed P-256 public key.
 * This is the canonical human-readable identifier for a Node Zero instance.
 */
export type NodeId = Brand<string, "NodeId">;

/**
 * A 33-byte SEC1 compressed P-256 public key (0x02 or 0x03 prefix).
 */
export type CompressedPublicKey = Brand<Uint8Array, "CompressedPublicKey">;

/**
 * A 64-byte ECDSA-P256-SHA256 signature (r || s, big-endian).
 */
export type ECDSASignature = Brand<Uint8Array, "ECDSASignature">;

/**
 * An 8-bit key sequence counter, incremented on each rotation.
 * Initial key has keySeq = 0.
 */
export type KeySequence = Brand<number, "KeySequence">;

// ─── Cryptographic Brands ───────────────────────────────────────────

/**
 * A 32-byte AES-256-GCM Data Encryption Key, never stored in plaintext.
 * Always wrapped (encrypted) with the owner's or partner's public key.
 */
export type WrappedDEK = Brand<Uint8Array, "WrappedDEK">;

/**
 * A 32-byte symmetric key derived via ECDH + HKDF.
 */
export type SharedSecret = Brand<Uint8Array, "SharedSecret">;

/**
 * AES-256-GCM ciphertext with appended authentication tag.
 */
export type EncryptedBlob = Brand<Uint8Array, "EncryptedBlob">;

/**
 * A 12-byte (96-bit) initialization vector for AES-256-GCM.
 */
export type AESNonce = Brand<Uint8Array, "AESNonce">;

/**
 * A 16-byte GCM authentication tag.
 */
export type AuthTag = Brand<Uint8Array, "AuthTag">;

// ─── Bond Brands ────────────────────────────────────────────────────

/**
 * A 32-byte random nonce used in challenge-response authentication.
 */
export type ChallengeNonce = Brand<Uint8Array, "ChallengeNonce">;

/**
 * A normalized floating-point value in [0.0, 1.0].
 */
export type Normalized = Brand<number, "Normalized">;

/**
 * A normalized floating-point value in [-1.0, +1.0].
 */
export type SignedNormalized = Brand<number, "SignedNormalized">;

// ─── Wire Format Brands ─────────────────────────────────────────────

/**
 * An unsigned 8-bit integer (0–255).
 */
export type Uint8 = Brand<number, "Uint8">;

/**
 * A signed 8-bit integer (-128 to 127).
 */
export type Int8 = Brand<number, "Int8">;

/**
 * A Unix timestamp in seconds (uint32).
 */
export type UnixTimestamp = Brand<number, "UnixTimestamp">;

// ─── Capability Brands ──────────────────────────────────────────────

/**
 * A base64-encoded UCAN (User Controlled Authorization Network) token.
 */
export type UCANToken = Brand<string, "UCANToken">;

/**
 * A human-readable vault layer identifier (e.g., "medical", "legal").
 */
export type LayerId = Brand<string, "LayerId">;
