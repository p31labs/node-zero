/**
 * @module interfaces/transport
 * @description ITransport — abstraction of physical communication media.
 *
 * Provides a unified API for BLE, LoRa (Sub-GHz / 2.4 GHz), and WebSocket.
 * Handles MTU constraints, SCHC fragmentation (RFC 8724), and duty-cycle
 * management for LoRa regulatory compliance.
 *
 * The transmit command abstracts time-on-air challenges:
 * at SF12, a 252-byte LoRa packet takes ~7 seconds to transmit.
 * ITransport must respect duty-cycle limits (< 10% in 868 MHz band).
 */

import type {
  TransportMedium,
  TransportConfig,
  TransportReceiveCallback,
  PeerDiscoveryCallback,
  DiscoveredPeer,
} from "../types/transport.js";

/**
 * Errors that may be thrown by ITransport operations.
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MEDIUM_UNAVAILABLE"
      | "MTU_EXCEEDED"
      | "DUTY_CYCLE_EXCEEDED"
      | "FRAGMENTATION_ERROR"
      | "REASSEMBLY_TIMEOUT"
      | "DISCOVERY_FAILED"
  ) {
    super(message);
    this.name = "TransportError";
  }
}

/**
 * @interface ITransport
 * @description The low-level abstraction for hardware radio interfaces.
 * Manages physical discovery, fragmentation, and reassembly.
 */
export interface ITransport {
  // ─── Commands ───────────────────────────────────────────────────

  /**
   * @command
   * @description Transmits a raw buffer over the active medium.
   * Automates SCHC fragmentation if the buffer exceeds the MTU.
   *
   * For LoRa: respects duty-cycle limits and manages preamble/timing.
   * For BLE: uses L2CAP/ATT segmentation.
   * For WebSocket: transmits directly (no fragmentation needed).
   *
   * @param data - The data to transmit.
   * @postcondition Emits TRANSMIT_COMPLETE on success.
   * @throws {TransportError} code=MTU_EXCEEDED if payload too large even after fragmentation.
   * @throws {TransportError} code=DUTY_CYCLE_EXCEEDED if LoRa duty cycle limit reached.
   * @throws {TransportError} code=MEDIUM_UNAVAILABLE if no transport is active.
   */
  transmit(data: Uint8Array): Promise<void>;

  /**
   * @command
   * @description Registers a callback for receiving reassembled data.
   * Fragments are collected, SCHC reassembled, and the complete
   * buffer delivered to the callback.
   *
   * @param callback - Called with reassembled data upon completion.
   * @returns Unsubscribe function.
   */
  onReceive(callback: TransportReceiveCallback): () => void;

  /**
   * @command
   * @description Initiates peer discovery on the active medium.
   *
   * BLE: Starts scanning for advertisement beacons.
   * LoRa: Broadcasts discovery beacons.
   * WebSocket: Queries known relay servers.
   *
   * @postcondition Emits PEER_DISCOVERED events as peers are found.
   * @throws {TransportError} code=DISCOVERY_FAILED if scanning fails.
   */
  discover(): Promise<void>;

  /**
   * @command
   * @description Registers a callback for peer discovery events.
   *
   * @param callback - Called when a new peer is discovered.
   * @returns Unsubscribe function.
   */
  onPeerDiscovered(callback: PeerDiscoveryCallback): () => void;

  /**
   * @command
   * @description Configures the transport with medium-specific parameters.
   *
   * @param config - Transport configuration (MTU, duty cycle, SF, etc.).
   */
  configure(config: TransportConfig): Promise<void>;

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * @query
   * @description Returns the maximum payload size for the current transport.
   * @returns The MTU in bytes.
   */
  getMTU(): number;

  /**
   * @query
   * @description Checks if the transport can handle a specific payload size.
   * Takes into account fragmentation capabilities.
   *
   * @param size - Byte size of the intended payload.
   * @returns True if the payload can be transmitted (possibly fragmented).
   */
  canTransmit(size: number): boolean;

  /**
   * @query
   * @description Returns the active transport medium.
   */
  getActiveMedium(): TransportMedium | null;

  /**
   * @query
   * @description Returns all discovered peers on the current medium.
   */
  getDiscoveredPeers(): readonly DiscoveredPeer[];
}
