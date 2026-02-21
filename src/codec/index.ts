/**
 * @module codec
 * @description Network Codec — binary serialization for mesh transmission.
 *
 * Handles the translation of TypeScript objects into bit-packed binary
 * payloads for LoRa/BLE transmission. Uses branded types throughout to
 * prevent injection or type-confusion at the compiler level.
 *
 * Packet types:
 * - 0x01: State (16 bytes)
 * - 0x02: Bond Handshake (43 bytes)
 * - 0x03: Vault Fragment (up to 256 bytes)
 */

import type { StateUpdateMessage, StateWireData } from "../types/state.js";
import type { BondHandshakePacket } from "../types/bond.js";
import type { VaultFragment } from "../types/vault.js";
import type { CompactIdentity } from "../types/identity.js";
import type {
  ECDSASignature,
  CompressedPublicKey,
  KeySequence,
  Uint8 as U8,
  UnixTimestamp,
} from "../types/branded.js";

// ─── Packet Type Constants ──────────────────────────────────────────

export const PACKET_TYPE_STATE = 0x01;
export const PACKET_TYPE_BOND = 0x02;
export const PACKET_TYPE_VAULT = 0x03;

// ─── State Codec ────────────────────────────────────────────────────

/**
 * Serialize a StateUpdateMessage to the 105-byte wire format.
 *
 * Layout:
 * - compact_identity: 34 bytes (pubkey 33 + keyseq 1)
 * - state_data: 7 bytes (urgency 1 + emotional 1 + cognitive 1 + timestamp 4)
 * - signature: 64 bytes (ECDSA r || s)
 * Total: 105 bytes
 *
 * @param message - The state update to serialize.
 * @returns 105-byte Uint8Array.
 */
export function serializeStateUpdate(message: StateUpdateMessage): Uint8Array {
  const buffer = new Uint8Array(105);
  let offset = 0;

  // Compact identity (34 bytes)
  buffer.set(
    message.identity.publicKey as Uint8Array,
    offset
  );
  offset += 33;
  buffer[offset++] = message.identity.keySequence as number;

  // State data (7 bytes)
  buffer[offset++] = message.stateData.urgency as number;
  buffer[offset++] = message.stateData.emotional as number;
  buffer[offset++] = message.stateData.cognitive as number;

  // Timestamp (4 bytes, big-endian)
  const ts = message.stateData.timestamp as number;
  buffer[offset++] = (ts >>> 24) & 0xff;
  buffer[offset++] = (ts >>> 16) & 0xff;
  buffer[offset++] = (ts >>> 8) & 0xff;
  buffer[offset++] = ts & 0xff;

  // Signature (64 bytes)
  buffer.set(message.signature as Uint8Array, offset);

  return buffer;
}

/**
 * Deserialize a 105-byte buffer into a StateUpdateMessage.
 *
 * @param buffer - 105-byte wire-format state update.
 * @returns Parsed StateUpdateMessage.
 * @throws {Error} If buffer length is not 105.
 */
export function deserializeStateUpdate(buffer: Uint8Array): StateUpdateMessage {
  if (buffer.length !== 105) {
    throw new Error(`Expected 105 bytes, got ${buffer.length}`);
  }

  let offset = 0;

  // Compact identity
  const publicKey = buffer.slice(offset, offset + 33) as CompressedPublicKey;
  offset += 33;
  const keySequence = buffer[offset++] as KeySequence;

  // State data
  const urgency = buffer[offset++] as U8;
  const emotional = buffer[offset++] as U8;
  const cognitive = buffer[offset++] as U8;

  // Timestamp (4 bytes, big-endian)
  const timestamp = (
    (buffer[offset]! << 24) |
    (buffer[offset + 1]! << 16) |
    (buffer[offset + 2]! << 8) |
    buffer[offset + 3]!
  ) as UnixTimestamp;
  offset += 4;

  // Signature
  const signature = buffer.slice(offset, offset + 64) as ECDSASignature;

  return {
    identity: { publicKey, keySequence },
    stateData: { urgency, emotional, cognitive, timestamp },
    signature,
  };
}

// ─── Bond Codec ─────────────────────────────────────────────────────

/**
 * Serialize a BondHandshakePacket to the 43-byte wire format.
 *
 * Layout:
 * - packetType: 1 byte (0x02)
 * - subType: 1 byte
 * - pubKey: 33 bytes (compressed P-256)
 * - qValue: 4 bytes (float32, big-endian)
 * - CRC: 4 bytes
 * Total: 43 bytes
 */
export function serializeBondHandshake(
  packet: BondHandshakePacket
): Uint8Array {
  const buffer = new Uint8Array(43);
  let offset = 0;

  buffer[offset++] = packet.packetType;
  buffer[offset++] = packet.subType;
  buffer.set(packet.publicKey as Uint8Array, offset);
  offset += 33;

  // Q value as float32 big-endian
  const view = new DataView(buffer.buffer, offset, 4);
  view.setFloat32(0, packet.qValue, false);
  offset += 4;

  // CRC-32 (placeholder — real impl uses CRC-32C)
  const crcView = new DataView(buffer.buffer, offset, 4);
  crcView.setUint32(0, packet.crc, false);

  return buffer;
}

/**
 * Deserialize a 43-byte buffer into a BondHandshakePacket.
 */
export function deserializeBondHandshake(
  buffer: Uint8Array
): BondHandshakePacket {
  if (buffer.length !== 43) {
    throw new Error(`Expected 43 bytes, got ${buffer.length}`);
  }

  let offset = 0;
  const packetType = buffer[offset++] as 0x02;
  const subType = buffer[offset++];
  const publicKey = buffer.slice(offset, offset + 33) as CompressedPublicKey;
  offset += 33;

  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  const qValue = view.getFloat32(0, false);
  offset += 4;

  const crcView = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
  const crc = crcView.getUint32(0, false);

  return { packetType, subType: subType!, publicKey, qValue, crc };
}

// ─── Vault Fragment Codec ───────────────────────────────────────────

/**
 * Serialize a VaultFragment to wire format (up to 256 bytes).
 */
export function serializeVaultFragment(fragment: VaultFragment): Uint8Array {
  const headerSize = 4;
  const buffer = new Uint8Array(headerSize + fragment.payload.length);

  buffer[0] = fragment.packetType;
  buffer[1] = fragment.layerIndex;
  buffer[2] = (fragment.sequence.current << 4) | (fragment.sequence.total & 0x0f);
  buffer[3] = ((fragment.sequence.current >> 4) & 0x0f) | ((fragment.sequence.total >> 4) << 4);
  buffer.set(fragment.payload, headerSize);

  return buffer;
}

/**
 * Deserialize a buffer into a VaultFragment.
 */
export function deserializeVaultFragment(buffer: Uint8Array): VaultFragment {
  if (buffer.length < 4) {
    throw new Error(`Vault fragment must be at least 4 bytes, got ${buffer.length}`);
  }

  return {
    packetType: buffer[0]! as 0x03,
    layerIndex: buffer[1]!,
    sequence: {
      current: (buffer[2]! >> 4) | ((buffer[3]! & 0x0f) << 4),
      total: (buffer[2]! & 0x0f) | ((buffer[3]! >> 4) << 4),
    },
    payload: buffer.slice(4),
  };
}

// ─── Utility: CRC-24 ───────────────────────────────────────────────

/**
 * Calculate CRC-24 for state packets (error detection).
 * Polynomial: 0x864CFB (same as OpenPGP).
 */
export function crc24(data: Uint8Array): number {
  let crc = 0xb704ce;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 16;
    for (let j = 0; j < 8; j++) {
      crc <<= 1;
      if (crc & 0x1000000) {
        crc ^= 0x864cfb;
      }
    }
  }
  return crc & 0xffffff;
}
