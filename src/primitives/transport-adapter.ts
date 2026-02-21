/**
 * @module primitives/transport-adapter
 * @description Skeleton implementation of the ITransport interface.
 *
 * Provides a unified API for BLE, LoRa, and WebSocket transports.
 * Handles SCHC fragmentation (RFC 8724), duty-cycle management,
 * and peer discovery.
 */

import { NodeZeroEmitter } from "./base-emitter.js";
import type { ITransport } from "../interfaces/transport.js";
import { TransportError } from "../interfaces/transport.js";
import type {
  TransportMedium,
  TransportConfig,
  TransportReceiveCallback,
  PeerDiscoveryCallback,
  DiscoveredPeer,
} from "../types/transport.js";
import type { UnixTimestamp } from "../types/branded.js";

/**
 * Default MTU values per transport medium.
 */
const DEFAULT_MTUS: Record<TransportMedium, number> = {
  BLE: 247,
  LORA_SUB_GHZ: 252,
  LORA_2_4_GHZ: 255,
  WEBSOCKET: 65535,
};

/**
 * TransportAdapter — physical media abstraction with SCHC fragmentation.
 *
 * @example
 * ```ts
 * const transport = new TransportAdapter();
 * await transport.configure({ medium: "LORA_SUB_GHZ", mtu: 252, spreadingFactor: 10 });
 * await transport.transmit(statePacketBytes);
 * ```
 */
export class TransportAdapter
  extends NodeZeroEmitter
  implements ITransport
{
  private activeMedium: TransportMedium | null = null;
  private mtu = 0;
  private config: TransportConfig | null = null;
  private receiveListeners: Set<TransportReceiveCallback> = new Set();
  private discoveryListeners: Set<PeerDiscoveryCallback> = new Set();
  private discoveredPeers: DiscoveredPeer[] = [];

  // ─── Commands ───────────────────────────────────────────────────

  async transmit(data: Uint8Array): Promise<void> {
    if (!this.activeMedium) {
      throw new TransportError(
        "No transport medium configured",
        "MEDIUM_UNAVAILABLE"
      );
    }

    if (data.length > this.mtu) {
      // TODO: Implement SCHC fragmentation (RFC 8724)
      // - Generate RuleID for compression context
      // - Split payload into MTU-sized fragments
      // - Add sequence numbers and RCS
      // - Transmit each fragment with inter-fragment delay
      // For LoRa: respect duty cycle limits
      throw new TransportError(
        "Fragmentation not yet implemented",
        "FRAGMENTATION_ERROR"
      );
    }

    // TODO: Platform-specific transmission
    // BLE: Write to GATT characteristic
    // LoRa: SX1262 packet transmission via SPI
    // WebSocket: ws.send(data)

    this.emit({
      type: "TRANSMIT_COMPLETE",
      bytesSent: data.length,
      medium: this.activeMedium,
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
    });
  }

  onReceive(callback: TransportReceiveCallback): () => void {
    this.receiveListeners.add(callback);
    return () => {
      this.receiveListeners.delete(callback);
    };
  }

  async discover(): Promise<void> {
    if (!this.activeMedium) {
      throw new TransportError(
        "No transport medium configured",
        "MEDIUM_UNAVAILABLE"
      );
    }

    // TODO: Platform-specific discovery
    // BLE: Start scanning for Node Zero advertisement beacons
    // LoRa: Broadcast discovery beacon, listen for responses
    // WebSocket: Query known relay server endpoints

    throw new TransportError(
      "discover() not yet implemented",
      "DISCOVERY_FAILED"
    );
  }

  onPeerDiscovered(callback: PeerDiscoveryCallback): () => void {
    this.discoveryListeners.add(callback);
    return () => {
      this.discoveryListeners.delete(callback);
    };
  }

  async configure(config: TransportConfig): Promise<void> {
    this.config = config;
    this.activeMedium = config.medium;
    this.mtu = config.mtu || DEFAULT_MTUS[config.medium];
  }

  // ─── Queries ────────────────────────────────────────────────────

  getMTU(): number {
    return this.mtu;
  }

  canTransmit(size: number): boolean {
    if (!this.activeMedium) return false;
    // With fragmentation, we can transmit larger payloads
    // Max fragments: 65535 (16-bit sequence number)
    const maxPayload = this.mtu * 65535;
    return size <= maxPayload;
  }

  getActiveMedium(): TransportMedium | null {
    return this.activeMedium;
  }

  getDiscoveredPeers(): readonly DiscoveredPeer[] {
    return [...this.discoveredPeers];
  }

  // ─── Internal: Fragment Handling ────────────────────────────────

  /**
   * Called by the platform-specific receive handler when raw bytes arrive.
   * Handles reassembly of fragmented messages.
   */
  protected handleIncomingData(data: Uint8Array): void {
    // TODO: Check if this is a fragment (inspect SCHC headers)
    // If fragment: add to reassembly buffer, check if complete
    // If complete or unfragmented: notify all receive listeners

    for (const listener of this.receiveListeners) {
      listener(data);
    }
  }

  /**
   * Called by the platform-specific discovery handler when a peer is found.
   */
  protected handlePeerDiscovered(peer: DiscoveredPeer): void {
    this.discoveredPeers.push(peer);

    this.emit({
      type: "PEER_DISCOVERED",
      peer,
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
    });

    for (const listener of this.discoveryListeners) {
      listener(peer);
    }
  }
}
