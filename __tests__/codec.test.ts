import { describe, it, expect } from "vitest";
import {
  serializeStateUpdate,
  deserializeStateUpdate,
  serializeBondHandshake,
  deserializeBondHandshake,
  serializeVaultFragment,
  deserializeVaultFragment,
  crc24,
  PACKET_TYPE_STATE,
  PACKET_TYPE_BOND,
  PACKET_TYPE_VAULT,
} from "../src/codec/index.js";
import type {
  CompressedPublicKey,
  KeySequence,
  ECDSASignature,
  Uint8 as U8,
  UnixTimestamp,
} from "../src/types/branded.js";
import type { StateUpdateMessage } from "../src/types/state.js";
import type { BondHandshakePacket } from "../src/types/bond.js";
import type { VaultFragment } from "../src/types/vault.js";

describe("Network Codec", () => {
  describe("Constants", () => {
    it("should define correct packet type constants", () => {
      expect(PACKET_TYPE_STATE).toBe(0x01);
      expect(PACKET_TYPE_BOND).toBe(0x02);
      expect(PACKET_TYPE_VAULT).toBe(0x03);
    });
  });

  describe("serializeStateUpdate()", () => {
    it("should produce a 105-byte buffer", () => {
      const message = createTestStateUpdate();
      const buffer = serializeStateUpdate(message);
      expect(buffer.length).toBe(105);
    });

    it("should place compact identity in first 34 bytes", () => {
      const message = createTestStateUpdate();
      const buffer = serializeStateUpdate(message);
      // First 33 bytes = public key, byte 34 = key sequence
      expect(buffer[33]).toBe(0); // keySequence = 0
    });

    it("should encode state data in bytes 34-40", () => {
      const message = createTestStateUpdate();
      const buffer = serializeStateUpdate(message);
      expect(buffer[34]).toBe(128); // urgency
      expect(buffer[35]).toBe(64);  // emotional
      expect(buffer[36]).toBe(192); // cognitive
    });

    it("should encode timestamp as 4-byte big-endian", () => {
      const message = createTestStateUpdate();
      const buffer = serializeStateUpdate(message);
      // Timestamp bytes at offset 37-40
      const ts = (buffer[37] << 24) | (buffer[38] << 16) | (buffer[39] << 8) | buffer[40];
      expect(ts).toBe(1678901234);
    });

    it("should place signature in last 64 bytes", () => {
      const message = createTestStateUpdate();
      const buffer = serializeStateUpdate(message);
      // Signature starts at byte 41, 64 bytes long
      expect(buffer.length - 41).toBe(64);
    });
  });

  describe("deserializeStateUpdate()", () => {
    it("should roundtrip with serializeStateUpdate", () => {
      const original = createTestStateUpdate();
      const buffer = serializeStateUpdate(original);
      const parsed = deserializeStateUpdate(buffer);

      expect(parsed.stateData.urgency).toBe(original.stateData.urgency);
      expect(parsed.stateData.emotional).toBe(original.stateData.emotional);
      expect(parsed.stateData.cognitive).toBe(original.stateData.cognitive);
      expect(parsed.stateData.timestamp).toBe(original.stateData.timestamp);
      expect(parsed.identity.keySequence).toBe(original.identity.keySequence);
    });

    it("should throw for incorrect buffer length", () => {
      expect(() => deserializeStateUpdate(new Uint8Array(50))).toThrow();
    });
  });

  describe("serializeBondHandshake()", () => {
    it("should produce a 43-byte buffer", () => {
      const packet = createTestBondPacket();
      const buffer = serializeBondHandshake(packet);
      expect(buffer.length).toBe(43);
    });

    it("should encode packet type as 0x02", () => {
      const packet = createTestBondPacket();
      const buffer = serializeBondHandshake(packet);
      expect(buffer[0]).toBe(0x02);
    });

    it("should encode Q value as float32 big-endian", () => {
      const packet = createTestBondPacket();
      const buffer = serializeBondHandshake(packet);
      const view = new DataView(buffer.buffer, 35, 4);
      const qValue = view.getFloat32(0, false);
      expect(Math.abs(qValue - 0.35)).toBeLessThan(0.001);
    });
  });

  describe("deserializeBondHandshake()", () => {
    it("should roundtrip with serializeBondHandshake", () => {
      const original = createTestBondPacket();
      const buffer = serializeBondHandshake(original);
      const parsed = deserializeBondHandshake(buffer);

      expect(parsed.packetType).toBe(original.packetType);
      expect(parsed.subType).toBe(original.subType);
      expect(Math.abs(parsed.qValue - original.qValue)).toBeLessThan(0.001);
    });

    it("should throw for incorrect buffer length", () => {
      expect(() => deserializeBondHandshake(new Uint8Array(20))).toThrow();
    });
  });

  describe("serializeVaultFragment()", () => {
    it("should produce a buffer with 4-byte header + payload", () => {
      const fragment = createTestVaultFragment();
      const buffer = serializeVaultFragment(fragment);
      expect(buffer.length).toBe(4 + fragment.payload.length);
    });

    it("should encode packet type as 0x03", () => {
      const fragment = createTestVaultFragment();
      const buffer = serializeVaultFragment(fragment);
      expect(buffer[0]).toBe(0x03);
    });
  });

  describe("deserializeVaultFragment()", () => {
    it("should extract payload correctly", () => {
      const fragment = createTestVaultFragment();
      const buffer = serializeVaultFragment(fragment);
      const parsed = deserializeVaultFragment(buffer);

      expect(parsed.packetType).toBe(0x03);
      expect(parsed.layerIndex).toBe(fragment.layerIndex);
      expect(parsed.payload.length).toBe(fragment.payload.length);
    });

    it("should throw for buffer smaller than 4 bytes", () => {
      expect(() => deserializeVaultFragment(new Uint8Array(2))).toThrow();
    });
  });

  describe("crc24()", () => {
    it("should return a 24-bit value", () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = crc24(data);
      expect(result).toBeLessThanOrEqual(0xffffff);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should produce different values for different inputs", () => {
      const a = crc24(new Uint8Array([1, 2, 3]));
      const b = crc24(new Uint8Array([4, 5, 6]));
      expect(a).not.toBe(b);
    });

    it("should produce the same value for identical inputs", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      expect(crc24(data)).toBe(crc24(data));
    });
  });
});

// ─── Test Helpers ───────────────────────────────────────────────────

function createTestStateUpdate(): StateUpdateMessage {
  const pubKey = new Uint8Array(33);
  pubKey[0] = 0x03; // Compressed key prefix
  for (let i = 1; i < 33; i++) pubKey[i] = i;

  return {
    identity: {
      publicKey: pubKey as CompressedPublicKey,
      keySequence: 0 as KeySequence,
    },
    stateData: {
      urgency: 128 as U8,
      emotional: 64 as U8,
      cognitive: 192 as U8,
      timestamp: 1678901234 as UnixTimestamp,
    },
    signature: new Uint8Array(64) as ECDSASignature,
  };
}

function createTestBondPacket(): BondHandshakePacket {
  const pubKey = new Uint8Array(33);
  pubKey[0] = 0x02;
  return {
    packetType: 0x02,
    subType: 0x01,
    publicKey: pubKey as CompressedPublicKey,
    qValue: 0.35,
    crc: 0,
  };
}

function createTestVaultFragment(): VaultFragment {
  return {
    packetType: 0x03,
    layerIndex: 1,
    sequence: { current: 0, total: 3 },
    payload: new Uint8Array([10, 20, 30, 40, 50]),
  };
}
