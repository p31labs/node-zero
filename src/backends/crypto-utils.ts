/**
 * @module backends/crypto-utils
 * @description Shared cryptographic utilities built on WebCrypto.
 *
 * Provides:
 * - P-256 key import/export with SEC1 compressed encoding
 * - ECDH shared secret derivation
 * - HKDF key expansion
 * - AES-256-GCM encrypt/decrypt
 * - SHA-256 hashing
 * - Base58Check encoding (for NodeId generation)
 *
 * All functions are pure and stateless — they take inputs and return
 * branded types. No CryptoKey objects leak outside this module.
 */

import type {
  CompressedPublicKey,
  ECDSASignature,
  SharedSecret,
  EncryptedBlob,
  AESNonce,
  NodeId,
} from "../types/branded.js";

// ─── Globals ───────────────────────────────────────────────────────

const subtle =
  typeof globalThis.crypto?.subtle !== "undefined"
    ? globalThis.crypto.subtle
    : undefined;

function requireSubtle(): SubtleCrypto {
  if (!subtle) {
    throw new Error(
      "WebCrypto SubtleCrypto not available in this environment"
    );
  }
  return subtle;
}

/**
 * Strip branded type wrapper for WebCrypto BufferSource compatibility.
 * TypeScript 5.x DOM types expect `Uint8Array<ArrayBuffer>` but branded
 * types produce `Uint8Array<ArrayBufferLike>`. This creates a clean copy.
 */
export function buf(data: Uint8Array): ArrayBuffer {
  // Slice creates a new ArrayBuffer (not SharedArrayBuffer), safe for WebCrypto
  return new Uint8Array(data).buffer as ArrayBuffer;
}

// ─── P-256 Point Compression ───────────────────────────────────────

/**
 * Compress a 65-byte uncompressed P-256 public key to 33-byte SEC1 format.
 *
 * Uncompressed: 0x04 || x (32 bytes) || y (32 bytes)
 * Compressed:   (0x02 | parity(y)) || x (32 bytes)
 */
export function compressPublicKey(
  uncompressed: Uint8Array
): CompressedPublicKey {
  if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
    throw new Error(
      `Expected 65-byte uncompressed key (0x04 prefix), got ${uncompressed.length} bytes`
    );
  }

  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const prefix = (y[31]! & 1) === 0 ? 0x02 : 0x03;

  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);

  return compressed as CompressedPublicKey;
}

/**
 * Decompress a 33-byte SEC1 compressed P-256 public key to 65-byte uncompressed.
 *
 * Uses the curve equation y² = x³ - 3x + b (mod p) to recover y.
 * P-256 parameters from NIST FIPS 186-4.
 */
export function decompressPublicKey(
  compressed: CompressedPublicKey
): Uint8Array {
  if (compressed.length !== 33) {
    throw new Error(
      `Expected 33-byte compressed key, got ${compressed.length} bytes`
    );
  }

  const prefix = compressed[0]!;
  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error(`Invalid compression prefix: 0x${prefix.toString(16)}`);
  }

  // P-256 curve parameters
  const p = BigInt(
    "0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"
  );
  const b = BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"
  );

  // Extract x coordinate
  const xBytes = compressed.slice(1, 33);
  let x = BigInt(0);
  for (let i = 0; i < 32; i++) {
    x = (x << BigInt(8)) | BigInt(xBytes[i]!);
  }

  // Compute y² = x³ - 3x + b (mod p)
  const x3 = modPow(x, BigInt(3), p);
  const threeX = (BigInt(3) * x) % p;
  let y2 = (x3 - threeX + b) % p;
  if (y2 < BigInt(0)) y2 += p;

  // Square root: y = y2^((p+1)/4) mod p (works because p ≡ 3 mod 4)
  const exp = (p + BigInt(1)) / BigInt(4);
  let y = modPow(y2, exp, p);

  // Select correct parity
  const wantOdd = prefix === 0x03;
  const isOdd = (y & BigInt(1)) === BigInt(1);
  if (wantOdd !== isOdd) {
    y = p - y;
  }

  // Assemble uncompressed key
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;

  const yBytes = new Uint8Array(32);
  let tmp = y;
  for (let i = 31; i >= 0; i--) {
    yBytes[i] = Number(tmp & BigInt(0xff));
    tmp >>= BigInt(8);
  }

  uncompressed.set(xBytes, 1);
  uncompressed.set(yBytes, 33);

  return uncompressed;
}

/** Modular exponentiation: base^exp mod mod */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BigInt(1);
  base = ((base % mod) + mod) % mod;
  while (exp > BigInt(0)) {
    if ((exp & BigInt(1)) === BigInt(1)) {
      result = (result * base) % mod;
    }
    exp >>= BigInt(1);
    base = (base * base) % mod;
  }
  return result;
}

// ─── Key Import/Export ─────────────────────────────────────────────

/**
 * Import a 33-byte compressed P-256 public key as a WebCrypto CryptoKey.
 *
 * @param compressed - SEC1 compressed public key.
 * @param usage - Key usage: "verify" for ECDSA, "deriveBits" for ECDH.
 */
export async function importPublicKey(
  compressed: CompressedPublicKey,
  usage: "verify" | "deriveBits"
): Promise<CryptoKey> {
  const s = requireSubtle();
  const uncompressed = decompressPublicKey(compressed);

  const algorithm =
    usage === "verify"
      ? { name: "ECDSA", namedCurve: "P-256" }
      : { name: "ECDH", namedCurve: "P-256" };

  return s.importKey(
    "raw",
    buf(uncompressed),
    algorithm,
    true,
    usage === "verify" ? ["verify"] : []
  );
}

/**
 * Export a CryptoKey to 33-byte SEC1 compressed format.
 */
export async function exportCompressedPublicKey(
  key: CryptoKey
): Promise<CompressedPublicKey> {
  const s = requireSubtle();
  const raw = await s.exportKey("raw", key);
  return compressPublicKey(new Uint8Array(raw));
}

// ─── ECDH + HKDF ──────────────────────────────────────────────────

/**
 * Derive a 32-byte shared secret using ECDH + HKDF.
 *
 * @param privateKey - Our ECDH private key.
 * @param peerPublicKey - Peer's compressed P-256 public key.
 * @param info - HKDF info string (e.g., "node-zero-bond-v1").
 * @param salt - Optional 32-byte salt (defaults to zeros).
 * @returns 32-byte SharedSecret.
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CompressedPublicKey,
  info: string,
  salt?: Uint8Array
): Promise<SharedSecret> {
  const s = requireSubtle();

  // Import peer's public key for ECDH
  const peerKey = await importPublicKey(peerPublicKey, "deriveBits");

  // Raw ECDH: derive 256 bits of shared material
  const rawBits = await s.deriveBits(
    { name: "ECDH", public: peerKey },
    privateKey,
    256
  );

  // Import raw bits as HKDF input key material
  const hkdfKey = await s.importKey(
    "raw",
    rawBits,
    "HKDF",
    false,
    ["deriveBits"]
  );

  // HKDF expand to 32 bytes
  const encoder = new TextEncoder();
  const saltBuf = salt ? buf(salt) : buf(new Uint8Array(32));
  const infoBuf = buf(encoder.encode(info));
  const derivedBits = await s.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBuf,
      info: infoBuf,
    },
    hkdfKey,
    256
  );

  return new Uint8Array(derivedBits) as SharedSecret;
}

// ─── AES-256-GCM ──────────────────────────────────────────────────

/**
 * Encrypt data with AES-256-GCM.
 *
 * @param key - 32-byte encryption key.
 * @param plaintext - Data to encrypt.
 * @param aad - Optional Additional Authenticated Data.
 * @returns { ciphertext, nonce } where ciphertext includes the 16-byte auth tag.
 */
export async function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array
): Promise<{ ciphertext: EncryptedBlob; nonce: AESNonce }> {
  const s = requireSubtle();

  // Generate 12-byte nonce
  const nonce = globalThis.crypto.getRandomValues(
    new Uint8Array(12)
  ) as AESNonce;

  // Import key
  const cryptoKey = await s.importKey(
    "raw",
    buf(key),
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Encrypt (WebCrypto appends 16-byte auth tag to ciphertext)
  const params: AesGcmParams = { name: "AES-GCM", iv: buf(nonce) };
  if (aad) params.additionalData = buf(aad);

  const encrypted = await s.encrypt(params, cryptoKey, buf(plaintext));

  return {
    ciphertext: new Uint8Array(encrypted) as EncryptedBlob,
    nonce,
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 *
 * @param key - 32-byte decryption key.
 * @param ciphertext - Ciphertext with appended auth tag.
 * @param nonce - 12-byte IV used during encryption.
 * @param aad - Optional Additional Authenticated Data.
 * @returns Decrypted plaintext.
 */
export async function aesGcmDecrypt(
  key: Uint8Array,
  ciphertext: EncryptedBlob,
  nonce: AESNonce,
  aad?: Uint8Array
): Promise<Uint8Array> {
  const s = requireSubtle();

  const cryptoKey = await s.importKey(
    "raw",
    buf(key),
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const params: AesGcmParams = { name: "AES-GCM", iv: buf(nonce) };
  if (aad) params.additionalData = buf(aad);

  const decrypted = await s.decrypt(params, cryptoKey, buf(ciphertext));

  return new Uint8Array(decrypted);
}

// ─── Hashing ───────────────────────────────────────────────────────

/**
 * SHA-256 hash.
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const s = requireSubtle();
  const hash = await s.digest("SHA-256", buf(data));
  return new Uint8Array(hash);
}

// ─── Base58Check Encoding ──────────────────────────────────────────

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode bytes to Base58 (Bitcoin-style, no checksum suffix).
 */
export function base58Encode(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = (num << BigInt(8)) | BigInt(bytes[i]!);
  }

  let str = "";
  while (num > BigInt(0)) {
    const rem = Number(num % BigInt(58));
    str = BASE58_ALPHABET[rem]! + str;
    num /= BigInt(58);
  }

  // Preserve leading zeros
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      str = "1" + str;
    } else {
      break;
    }
  }

  return str || "1";
}

/**
 * Derive a NodeId from a compressed public key.
 * NodeId = Base58(SHA-256(compressedPublicKey))
 */
export async function deriveNodeId(
  publicKey: CompressedPublicKey
): Promise<NodeId> {
  const hash = await sha256(publicKey);
  return base58Encode(hash) as NodeId;
}

// ─── ECDSA Signature Conversion ────────────────────────────────────

/**
 * Convert a WebCrypto DER-encoded ECDSA signature to raw 64-byte (r || s).
 *
 * WebCrypto P-256 signatures use IEEE P1363 format (fixed 64 bytes).
 * This function handles both DER and P1363 inputs.
 */
export function normalizeSignature(sig: Uint8Array): ECDSASignature {
  if (sig.length === 64) {
    return sig as ECDSASignature;
  }

  // DER decode: SEQUENCE { INTEGER r, INTEGER s }
  if (sig[0] !== 0x30) {
    throw new Error("Unknown signature format");
  }

  let offset = 2; // Skip SEQUENCE tag + length
  if (sig[1]! > 0x80) offset += sig[1]! - 0x80;

  // Read r
  if (sig[offset] !== 0x02) throw new Error("Expected INTEGER tag for r");
  offset++;
  const rLen = sig[offset++]!;
  const rRaw = sig.slice(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (sig[offset] !== 0x02) throw new Error("Expected INTEGER tag for s");
  offset++;
  const sLen = sig[offset++]!;
  const sRaw = sig.slice(offset, offset + sLen);

  // Pad/trim to 32 bytes each
  const r = new Uint8Array(32);
  const s = new Uint8Array(32);
  r.set(rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw, 32 - Math.min(rRaw.length, 32));
  s.set(sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw, 32 - Math.min(sRaw.length, 32));

  const result = new Uint8Array(64);
  result.set(r, 0);
  result.set(s, 32);

  return result as ECDSASignature;
}

/**
 * Generate a random nonce of the specified length.
 */
export function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}
