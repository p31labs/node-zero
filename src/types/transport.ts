/**
 * @module types/transport
 * @description Transport abstraction for physical communication media.
 *
 * ITransport provides a unified API across BLE, LoRa (Sub-GHz and 2.4 GHz),
 * and WebSocket. Handles MTU constraints, SCHC fragmentation (RFC 8724),
 * and duty-cycle management for LoRa.
 *
 * | Transport      | Typical MTU | Fragmentation Protocol |
 * |----------------|-------------|------------------------|
 * | BLE            | 247 bytes   | L2CAP / ATT            |
 * | LoRa (Sub-GHz) | 252 bytes   | SCHC ACK-on-Error      |
 * | LoRa (2.4 GHz) | 255 bytes   | SX1280 Packet Mode     |
 * | WebSocket      | 65535 bytes | Native (none needed)   |
 */

import type { NodeId, UnixTimestamp } from "./branded.js";

// ─── Transport Medium ───────────────────────────────────────────────

/**
 * Supported physical transport media.
 */
export type TransportMedium = "BLE" | "LORA_SUB_GHZ" | "LORA_2_4_GHZ" | "WEBSOCKET";

/**
 * Travel/routing mode for mesh propagation.
 */
export type RoutingMode = "DIRECT" | "MESH_RELAY" | "BROADCAST";

// ─── Fragment ───────────────────────────────────────────────────────

/**
 * A single fragment of a larger message.
 * Uses SCHC-style Rule IDs for compression context.
 */
export interface TransportFragment {
  /** SCHC Rule ID identifying the compression context. */
  readonly ruleId: number;
  /** Fragment index (0-based). */
  readonly fragmentIndex: number;
  /** Total number of fragments. */
  readonly totalFragments: number;
  /** Fragment payload bytes. */
  readonly payload: Uint8Array;
  /** Reassembly Check Sequence for integrity. */
  readonly rcs?: number;
}

// ─── Relay Message ──────────────────────────────────────────────────

/**
 * A relayed message with TTL for mesh propagation.
 * TTL is decremented on each hop; dropped at 0.
 *
 * Layout: ttl (1 byte) || original_message (variable)
 * Signature covers the original payload only (not TTL),
 * allowing relays to modify TTL without breaking authentication.
 */
export interface RelayEnvelope {
  /** Time-to-live: hops remaining. Initial default: 3. */
  readonly ttl: number;
  /** Original message bytes (including signature). */
  readonly payload: Uint8Array;
  /** SHA-256 of the signature for deduplication cache lookup. */
  readonly deduplicationKey: string;
}

// ─── Peer Discovery ─────────────────────────────────────────────────

/**
 * A discovered peer on the transport layer.
 */
export interface DiscoveredPeer {
  /** NodeId derived from the peer's public key (if available). */
  readonly nodeId?: NodeId;
  /** Raw public key bytes from the discovery beacon. */
  readonly publicKey?: Uint8Array;
  /** Transport medium over which the peer was discovered. */
  readonly medium: TransportMedium;
  /** Signal strength indicator (RSSI in dBm, if available). */
  readonly rssi?: number;
  /** Discovery timestamp. */
  readonly discoveredAt: UnixTimestamp;
}

// ─── Transport Configuration ────────────────────────────────────────

/**
 * Configuration for a transport medium.
 */
export interface TransportConfig {
  /** Which medium to configure. */
  readonly medium: TransportMedium;
  /** Maximum Transmission Unit in bytes. */
  readonly mtu: number;
  /**
   * Duty cycle limit (0.0–1.0) for LoRa regulatory compliance.
   * Typically < 0.10 (10%) in the 868 MHz band.
   */
  readonly dutyCycleLimit?: number;
  /**
   * LoRa spreading factor (7–12).
   * Higher SF = longer range but slower transmission.
   * SF12 @ 252 bytes ≈ 7 seconds time-on-air.
   */
  readonly spreadingFactor?: number;
  /** Custom preamble length (default: 16 for Node Zero). */
  readonly preambleLength?: number;
}

// ─── Transport Callback ─────────────────────────────────────────────

/**
 * Callback for receiving reassembled data from the transport layer.
 */
export type TransportReceiveCallback = (data: Uint8Array) => void;

/**
 * Callback for peer discovery events.
 */
export type PeerDiscoveryCallback = (peer: DiscoveredPeer) => void;

/**
 * Callback for fragment-level reception (used by the codec).
 */
export type FragmentHandler = (fragment: TransportFragment) => void;
