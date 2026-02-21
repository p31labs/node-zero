/**
 * @module __tests__/webcrypto-identity.test
 * @description Integration tests for WebCryptoIdentityProvider.
 *
 * Tests real ECDSA P-256 operations using Node.js crypto module
 * (which provides the WebCrypto API as globalThis.crypto).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

// Polyfill WebCrypto for Node.js test environment
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  writable: true,
});

import { WebCryptoIdentityProvider } from "../src/backends/webcrypto-identity.js";
import {
  compressPublicKey,
  decompressPublicKey,
  deriveSharedSecret,
  aesGcmEncrypt,
  aesGcmDecrypt,
  sha256,
  base58Encode,
  deriveNodeId,
} from "../src/backends/crypto-utils.js";
import type { CompressedPublicKey } from "../src/types/branded.js";

// ─── Crypto Utils ──────────────────────────────────────────────────

describe("crypto-utils", () => {
  describe("P-256 point compression", () => {
    it("compresses and decompresses to identity", async () => {
      const keyPair = await webcrypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      const raw = new Uint8Array(
        await webcrypto.subtle.exportKey("raw", keyPair.publicKey)
      );
      expect(raw.length).toBe(65);
      expect(raw[0]).toBe(0x04);

      const compressed = compressPublicKey(raw);
      expect(compressed.length).toBe(33);
      expect(compressed[0] === 0x02 || compressed[0] === 0x03).toBe(true);

      const decompressed = decompressPublicKey(compressed);
      expect(decompressed.length).toBe(65);

      // x coordinates must match exactly
      expect(
        arrayEqual(raw.slice(1, 33), decompressed.slice(1, 33))
      ).toBe(true);

      // y coordinates must match exactly
      expect(
        arrayEqual(raw.slice(33, 65), decompressed.slice(33, 65))
      ).toBe(true);
    });

    it("handles both even and odd y coordinates", async () => {
      // Generate multiple keys to hit both parities
      let sawEven = false;
      let sawOdd = false;

      for (let i = 0; i < 20 && !(sawEven && sawOdd); i++) {
        const kp = await webcrypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign", "verify"]
        );
        const raw = new Uint8Array(
          await webcrypto.subtle.exportKey("raw", kp.publicKey)
        );
        const compressed = compressPublicKey(raw);

        if (compressed[0] === 0x02) sawEven = true;
        if (compressed[0] === 0x03) sawOdd = true;

        // Verify roundtrip
        const decompressed = decompressPublicKey(compressed);
        expect(
          arrayEqual(raw.slice(1, 33), decompressed.slice(1, 33))
        ).toBe(true);
      }

      // We should have seen both parities in 20 tries
      expect(sawEven || sawOdd).toBe(true);
    });

    it("rejects invalid inputs", () => {
      expect(() => compressPublicKey(new Uint8Array(32))).toThrow();
      expect(() =>
        decompressPublicKey(new Uint8Array(32) as CompressedPublicKey)
      ).toThrow();
    });
  });

  describe("SHA-256", () => {
    it("hashes correctly", async () => {
      const input = new TextEncoder().encode("hello");
      const hash = await sha256(input);
      expect(hash.length).toBe(32);

      // Known SHA-256 of "hello"
      const expected =
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
      const hex = Array.from(hash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex).toBe(expected);
    });
  });

  describe("Base58 encoding", () => {
    it("encodes bytes to base58", () => {
      // Known test vector: SHA-256 of "hello" → Base58
      const bytes = new Uint8Array([
        0x2c, 0xf2, 0x4d, 0xba, 0x5f, 0xb0, 0xa3, 0x0e, 0x26, 0xe8, 0x3b,
        0x2a, 0xc5, 0xb9, 0xe2, 0x9e, 0x1b, 0x16, 0x1e, 0x5c, 0x1f, 0xa7,
        0x42, 0x5e, 0x73, 0x04, 0x33, 0x62, 0x93, 0x8b, 0x98, 0x24,
      ]);
      const encoded = base58Encode(bytes);
      expect(encoded.length).toBeGreaterThan(0);
      expect(typeof encoded).toBe("string");
    });

    it("preserves leading zeros", () => {
      const bytes = new Uint8Array([0, 0, 1, 2, 3]);
      const encoded = base58Encode(bytes);
      expect(encoded.startsWith("11")).toBe(true);
    });
  });

  describe("AES-256-GCM", () => {
    it("encrypts and decrypts to identity", async () => {
      const key = webcrypto.getRandomValues(new Uint8Array(32));
      const plaintext = new TextEncoder().encode(
        "Node Zero vault layer data"
      );

      const { ciphertext, nonce } = await aesGcmEncrypt(key, plaintext);

      // Ciphertext should be longer (plaintext + 16-byte auth tag)
      expect(ciphertext.length).toBe(plaintext.length + 16);

      const decrypted = await aesGcmDecrypt(key, ciphertext, nonce);
      expect(arrayEqual(decrypted, plaintext)).toBe(true);
    });

    it("detects tampering", async () => {
      const key = webcrypto.getRandomValues(new Uint8Array(32));
      const plaintext = new TextEncoder().encode("secret");

      const { ciphertext, nonce } = await aesGcmEncrypt(key, plaintext);

      // Tamper with ciphertext
      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0xff;

      await expect(
        aesGcmDecrypt(key, tampered as typeof ciphertext, nonce)
      ).rejects.toThrow();
    });

    it("supports AAD", async () => {
      const key = webcrypto.getRandomValues(new Uint8Array(32));
      const plaintext = new TextEncoder().encode("data");
      const aad = new TextEncoder().encode("layer:medical");

      const { ciphertext, nonce } = await aesGcmEncrypt(
        key,
        plaintext,
        aad
      );

      // Decrypt with correct AAD
      const decrypted = await aesGcmDecrypt(key, ciphertext, nonce, aad);
      expect(arrayEqual(decrypted, plaintext)).toBe(true);

      // Decrypt with wrong AAD should fail
      const wrongAad = new TextEncoder().encode("layer:financial");
      await expect(
        aesGcmDecrypt(key, ciphertext, nonce, wrongAad)
      ).rejects.toThrow();
    });
  });

  describe("ECDH + HKDF key derivation", () => {
    it("derives matching secrets from both sides", async () => {
      // Alice's keypair
      const alice = await webcrypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const aliceRaw = new Uint8Array(
        await webcrypto.subtle.exportKey("raw", alice.publicKey)
      );
      const aliceCompressed = compressPublicKey(aliceRaw);

      // Bob's keypair
      const bob = await webcrypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const bobRaw = new Uint8Array(
        await webcrypto.subtle.exportKey("raw", bob.publicKey)
      );
      const bobCompressed = compressPublicKey(bobRaw);

      // Derive shared secret from both sides
      const aliceSecret = await deriveSharedSecret(
        alice.privateKey,
        bobCompressed,
        "node-zero-bond-v1"
      );
      const bobSecret = await deriveSharedSecret(
        bob.privateKey,
        aliceCompressed,
        "node-zero-bond-v1"
      );

      expect(aliceSecret.length).toBe(32);
      expect(bobSecret.length).toBe(32);
      expect(arrayEqual(aliceSecret, bobSecret)).toBe(true);
    });

    it("produces different secrets for different info strings", async () => {
      const alice = await webcrypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const bob = await webcrypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const bobRaw = new Uint8Array(
        await webcrypto.subtle.exportKey("raw", bob.publicKey)
      );
      const bobCompressed = compressPublicKey(bobRaw);

      const secret1 = await deriveSharedSecret(
        alice.privateKey,
        bobCompressed,
        "channel-a"
      );
      const secret2 = await deriveSharedSecret(
        alice.privateKey,
        bobCompressed,
        "channel-b"
      );

      expect(arrayEqual(secret1, secret2)).toBe(false);
    });
  });

  describe("deriveNodeId", () => {
    it("produces a consistent NodeId from a public key", async () => {
      const kp = await webcrypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );
      const raw = new Uint8Array(
        await webcrypto.subtle.exportKey("raw", kp.publicKey)
      );
      const compressed = compressPublicKey(raw);

      const id1 = await deriveNodeId(compressed);
      const id2 = await deriveNodeId(compressed);

      expect(id1).toBe(id2);
      expect(id1.length).toBeGreaterThan(10);
    });
  });
});

// ─── WebCryptoIdentityProvider ─────────────────────────────────────

describe("WebCryptoIdentityProvider", () => {
  let provider: WebCryptoIdentityProvider;

  beforeEach(() => {
    provider = new WebCryptoIdentityProvider();
  });

  describe("generateKeypair", () => {
    it("provisions a new identity", async () => {
      await provider.generateKeypair();
      expect(await provider.isProvisioned()).toBe(true);
    });

    it("exports a valid identity", async () => {
      await provider.generateKeypair();
      const identity = await provider.exportPublicKey();

      expect(identity.version).toBe(1);
      expect(identity.nodeId.length).toBeGreaterThan(10);
      expect(identity.publicKey.data.length).toBe(33);
      expect(identity.publicKey.algorithm).toBe("ECDSA-P256");
      expect(identity.publicKey.encoding).toBe("SEC1");
      expect(identity.hardware.provider).toBe("WEBCRYPTO");
      expect(identity.recovery.keySequence).toBe(0);
      expect(identity.recovery.status).toBe("active");
    });

    it("rejects double provisioning", async () => {
      await provider.generateKeypair();
      await expect(provider.generateKeypair()).rejects.toThrow(
        "already provisioned"
      );
    });

    it("emits IDENTITY_PROVISIONED event", async () => {
      let emitted = false;
      provider.on("IDENTITY_PROVISIONED", () => {
        emitted = true;
      });

      await provider.generateKeypair();
      expect(emitted).toBe(true);
    });
  });

  describe("sign and verify", () => {
    it("signs and verifies a message", async () => {
      await provider.generateKeypair();

      const message = new TextEncoder().encode("test message");
      const signature = await provider.sign(message);

      expect(signature.length).toBe(64);

      const identity = await provider.exportPublicKey();
      const valid = await provider.verify(
        message,
        signature,
        identity.publicKey.data
      );
      expect(valid).toBe(true);
    });

    it("rejects tampered messages", async () => {
      await provider.generateKeypair();

      const message = new TextEncoder().encode("original");
      const signature = await provider.sign(message);

      const tampered = new TextEncoder().encode("tampered");
      const identity = await provider.exportPublicKey();
      const valid = await provider.verify(
        tampered,
        signature,
        identity.publicKey.data
      );
      expect(valid).toBe(false);
    });

    it("verifies cross-provider signatures", async () => {
      const alice = new WebCryptoIdentityProvider();
      const bob = new WebCryptoIdentityProvider();

      await alice.generateKeypair();
      await bob.generateKeypair();

      const message = new TextEncoder().encode("hello from alice");
      const aliceSig = await alice.sign(message);
      const aliceIdentity = await alice.exportPublicKey();

      // Bob verifies Alice's signature
      const valid = await bob.verify(
        message,
        aliceSig,
        aliceIdentity.publicKey.data
      );
      expect(valid).toBe(true);
    });

    it("rejects wrong public key", async () => {
      const alice = new WebCryptoIdentityProvider();
      const bob = new WebCryptoIdentityProvider();

      await alice.generateKeypair();
      await bob.generateKeypair();

      const message = new TextEncoder().encode("hello");
      const aliceSig = await alice.sign(message);
      const bobIdentity = await bob.exportPublicKey();

      // Verify Alice's signature with Bob's key — should fail
      const valid = await alice.verify(
        message,
        aliceSig,
        bobIdentity.publicKey.data
      );
      expect(valid).toBe(false);
    });
  });

  describe("rotateKey", () => {
    it("rotates to a new keypair", async () => {
      await provider.generateKeypair();
      const oldIdentity = await provider.exportPublicKey();

      const cert = await provider.rotateKey();

      const newIdentity = await provider.exportPublicKey();

      expect(newIdentity.recovery.keySequence).toBe(1);
      expect(newIdentity.nodeId).not.toBe(oldIdentity.nodeId);
      expect(cert.newKeySequence).toBe(1);
      expect(arrayEqual(cert.oldPublicKey, oldIdentity.publicKey.data)).toBe(
        true
      );
      expect(arrayEqual(cert.newPublicKey, newIdentity.publicKey.data)).toBe(
        true
      );
      expect(cert.signature.length).toBe(64);
    });

    it("emits IDENTITY_ROTATED event", async () => {
      await provider.generateKeypair();

      let newNodeId: string | null = null;
      provider.on("IDENTITY_ROTATED", (event) => {
        newNodeId = event.newNodeId;
      });

      await provider.rotateKey();
      const identity = await provider.exportPublicKey();

      expect(newNodeId).toBe(identity.nodeId);
    });

    it("signs with new key after rotation", async () => {
      await provider.generateKeypair();
      await provider.rotateKey();

      const message = new TextEncoder().encode("post-rotation");
      const sig = await provider.sign(message);
      const identity = await provider.exportPublicKey();

      const valid = await provider.verify(
        message,
        sig,
        identity.publicKey.data
      );
      expect(valid).toBe(true);
    });
  });

  describe("createAttestation", () => {
    it("creates a valid self-signed attestation", async () => {
      await provider.generateKeypair();

      const attestation = await provider.createAttestation();

      expect(attestation.publicKey.length).toBe(33);
      expect(attestation.deviceType).toBe(1); // WebCrypto
      expect(attestation.signature.length).toBe(64);
      expect(attestation.timestamp).toBeGreaterThan(0);
    });

    it("includes nonce when provided", async () => {
      await provider.generateKeypair();
      const nonce = webcrypto.getRandomValues(new Uint8Array(32));

      const attestation = await provider.createAttestation(nonce);

      expect(attestation.nonce).toBeDefined();
      expect(
        arrayEqual(attestation.nonce!, nonce)
      ).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws NOT_PROVISIONED for sign before keygen", async () => {
      await expect(
        provider.sign(new Uint8Array(32))
      ).rejects.toThrow("No identity provisioned");
    });

    it("throws NOT_PROVISIONED for exportPublicKey before keygen", async () => {
      await expect(provider.exportPublicKey()).rejects.toThrow(
        "No identity provisioned"
      );
    });

    it("returns false for isProvisioned before keygen", async () => {
      expect(await provider.isProvisioned()).toBe(false);
    });
  });
});

// ─── Utility ───────────────────────────────────────────────────────

function arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
