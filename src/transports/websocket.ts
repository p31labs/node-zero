/**
 * @module transports/websocket
 * @description WebSocket implementation of the ITransport interface.
 *
 * Provides real-time bidirectional communication between Node Zero instances
 * over WebSocket. No fragmentation needed (MTU = 65535).
 *
 * Architecture:
 * - Each node connects to a shared relay server
 * - The relay broadcasts messages to all connected peers
 * - Discovery is handled by a "presence" protocol over the same socket
 *
 * Wire protocol (over WebSocket binary frames):
 * - Byte 0: message type (0x01 = data, 0x02 = discovery beacon, 0x03 = presence)
 * - Byte 1-N: payload
 *
 * For the browser-based demo, the relay can be a simple echo server
 * or a BroadcastChannel for same-origin tab communication.
 */

import { NodeZeroEmitter } from "../primitives/base-emitter.js";
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

// ─── Wire Protocol Constants ───────────────────────────────────────

const MSG_DATA = 0x01;
const MSG_DISCOVERY = 0x02;
const MSG_PRESENCE = 0x03;

// ─── BroadcastChannel Transport (same-origin tabs) ─────────────────

/**
 * BroadcastChannelTransport — uses the BroadcastChannel API for
 * same-origin communication between browser tabs.
 *
 * This is the fastest path to a working demo: no server needed,
 * two tabs on the same origin can exchange Node Zero packets directly.
 *
 * Falls back to a simple in-memory event bus for Node.js environments.
 */
export class BroadcastChannelTransport
  extends NodeZeroEmitter
  implements ITransport
{
  private channel: BroadcastChannel | null = null;
  private channelName: string;
  private mtu = 65535;
  private receiveListeners = new Set<TransportReceiveCallback>();
  private discoveryListeners = new Set<PeerDiscoveryCallback>();
  private discoveredPeers: DiscoveredPeer[] = [];
  private localIdentity: Uint8Array | null = null;

  constructor(channelName = "node-zero-mesh") {
    super();
    this.channelName = channelName;
  }

  // ─── Commands ───────────────────────────────────────────────────

  async transmit(data: Uint8Array): Promise<void> {
    if (!this.channel) {
      throw new TransportError(
        "Transport not configured. Call configure() first.",
        "MEDIUM_UNAVAILABLE"
      );
    }

    // Wrap with message type header
    const frame = new Uint8Array(1 + data.length);
    frame[0] = MSG_DATA;
    frame.set(data, 1);

    // BroadcastChannel can send ArrayBuffer
    this.channel.postMessage(frame.buffer);

    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
    this.emit({
      type: "TRANSMIT_COMPLETE",
      bytesSent: data.length,
      medium: "WEBSOCKET" as TransportMedium,
      timestamp: now,
    });
  }

  onReceive(callback: TransportReceiveCallback): () => void {
    this.receiveListeners.add(callback);
    return () => {
      this.receiveListeners.delete(callback);
    };
  }

  async discover(): Promise<void> {
    if (!this.channel) {
      throw new TransportError(
        "Transport not configured",
        "MEDIUM_UNAVAILABLE"
      );
    }

    // Broadcast discovery beacon with our identity
    if (this.localIdentity) {
      const frame = new Uint8Array(1 + this.localIdentity.length);
      frame[0] = MSG_DISCOVERY;
      frame.set(this.localIdentity, 1);
      this.channel.postMessage(frame.buffer);
    }
  }

  onPeerDiscovered(callback: PeerDiscoveryCallback): () => void {
    this.discoveryListeners.add(callback);
    return () => {
      this.discoveryListeners.delete(callback);
    };
  }

  async configure(config: TransportConfig): Promise<void> {
    // Clean up existing channel
    if (this.channel) {
      this.channel.close();
    }

    this.mtu = config.mtu || 65535;

    // Open BroadcastChannel
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data as ArrayBuffer);
      };
    } else {
      // Fallback for Node.js: use the in-memory event bus
      this.channel = InMemoryBus.getChannel(this.channelName, (data) => {
        this.handleMessage(data);
      });
    }
  }

  /**
   * Set the local identity bytes for discovery beacons.
   * Called after identity provisioning.
   */
  setLocalIdentity(identity: Uint8Array): void {
    this.localIdentity = identity;
  }

  /**
   * Shut down the transport cleanly.
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.receiveListeners.clear();
    this.discoveryListeners.clear();
    this.discoveredPeers = [];
  }

  // ─── Queries ────────────────────────────────────────────────────

  getMTU(): number {
    return this.mtu;
  }

  canTransmit(size: number): boolean {
    return size <= this.mtu;
  }

  getActiveMedium(): TransportMedium | null {
    return this.channel ? "WEBSOCKET" : null;
  }

  getDiscoveredPeers(): readonly DiscoveredPeer[] {
    return [...this.discoveredPeers];
  }

  // ─── Internal ───────────────────────────────────────────────────

  private handleMessage(raw: ArrayBuffer): void {
    const data = new Uint8Array(raw);
    if (data.length < 1) return;

    const msgType = data[0]!;
    const payload = data.slice(1);

    switch (msgType) {
      case MSG_DATA:
        this.handleDataMessage(payload);
        break;
      case MSG_DISCOVERY:
        this.handleDiscoveryMessage(payload);
        break;
      case MSG_PRESENCE:
        // Future: presence heartbeats
        break;
    }
  }

  private handleDataMessage(payload: Uint8Array): void {
    for (const listener of this.receiveListeners) {
      listener(payload);
    }
  }

  private handleDiscoveryMessage(payload: Uint8Array): void {
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

    // Payload is the peer's compressed public key (33 bytes)
    const peer: DiscoveredPeer = {
      publicKey: payload.length >= 33 ? payload.slice(0, 33) : payload,
      medium: "WEBSOCKET",
      discoveredAt: now,
    };

    // Deduplicate
    const isDuplicate = this.discoveredPeers.some(
      (p) =>
        p.publicKey &&
        peer.publicKey &&
        arrayEqual(p.publicKey, peer.publicKey)
    );

    if (!isDuplicate) {
      this.discoveredPeers.push(peer);

      this.emit({
        type: "PEER_DISCOVERED",
        peer,
        timestamp: now,
      });

      for (const listener of this.discoveryListeners) {
        listener(peer);
      }
    }
  }
}

// ─── WebSocket Relay Transport ─────────────────────────────────────

/**
 * WebSocketRelayTransport — connects to a WebSocket relay server
 * for cross-origin or cross-network communication.
 *
 * The relay server simply broadcasts all messages to all connected clients.
 */
export class WebSocketRelayTransport
  extends NodeZeroEmitter
  implements ITransport
{
  private ws: WebSocket | null = null;
  private url: string;
  private mtu = 65535;
  private receiveListeners = new Set<TransportReceiveCallback>();
  private discoveryListeners = new Set<PeerDiscoveryCallback>();
  private discoveredPeers: DiscoveredPeer[] = [];
  private localIdentity: Uint8Array | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectDelay = 30000;

  constructor(url: string) {
    super();
    this.url = url;
  }

  // ─── Commands ───────────────────────────────────────────────────

  async transmit(data: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new TransportError(
        "WebSocket not connected",
        "MEDIUM_UNAVAILABLE"
      );
    }

    const frame = new Uint8Array(1 + data.length);
    frame[0] = MSG_DATA;
    frame.set(data, 1);

    this.ws.send(frame.buffer);

    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
    this.emit({
      type: "TRANSMIT_COMPLETE",
      bytesSent: data.length,
      medium: "WEBSOCKET",
      timestamp: now,
    });
  }

  onReceive(callback: TransportReceiveCallback): () => void {
    this.receiveListeners.add(callback);
    return () => {
      this.receiveListeners.delete(callback);
    };
  }

  async discover(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new TransportError(
        "WebSocket not connected",
        "MEDIUM_UNAVAILABLE"
      );
    }

    if (this.localIdentity) {
      const frame = new Uint8Array(1 + this.localIdentity.length);
      frame[0] = MSG_DISCOVERY;
      frame.set(this.localIdentity, 1);
      this.ws.send(frame.buffer);
    }
  }

  onPeerDiscovered(callback: PeerDiscoveryCallback): () => void {
    this.discoveryListeners.add(callback);
    return () => {
      this.discoveryListeners.delete(callback);
    };
  }

  async configure(_config: TransportConfig): Promise<void> {
    this.mtu = _config.mtu || 65535;
    await this.connect();
  }

  setLocalIdentity(identity: Uint8Array): void {
    this.localIdentity = identity;
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.receiveListeners.clear();
    this.discoveryListeners.clear();
  }

  // ─── Queries ────────────────────────────────────────────────────

  getMTU(): number {
    return this.mtu;
  }

  canTransmit(size: number): boolean {
    return size <= this.mtu;
  }

  getActiveMedium(): TransportMedium | null {
    return this.ws?.readyState === WebSocket.OPEN ? "WEBSOCKET" : null;
  }

  getDiscoveredPeers(): readonly DiscoveredPeer[] {
    return [...this.discoveredPeers];
  }

  // ─── Internal ───────────────────────────────────────────────────

  private async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => resolve();

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data as ArrayBuffer);
        };

        this.ws.onerror = () => {
          const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
          this.emit({
            type: "TRANSPORT_ERROR",
            medium: "WEBSOCKET",
            error: "WebSocket connection error",
            timestamp: now,
          });
        };

        this.ws.onclose = () => {
          this.scheduleReconnect();
        };
      } catch (err) {
        reject(
          new TransportError(
            `Failed to connect: ${err}`,
            "MEDIUM_UNAVAILABLE"
          )
        );
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    // Exponential backoff with jitter
    const delay = Math.min(
      1000 * Math.pow(2, Math.random() * 4),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        // Re-discover after reconnect
        await this.discover();
      } catch {
        // Will retry via onclose handler
      }
    }, delay);
  }

  private handleMessage(raw: ArrayBuffer): void {
    const data = new Uint8Array(raw);
    if (data.length < 1) return;

    const msgType = data[0]!;
    const payload = data.slice(1);

    switch (msgType) {
      case MSG_DATA:
        for (const listener of this.receiveListeners) {
          listener(payload);
        }
        break;

      case MSG_DISCOVERY: {
        const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
        const peer: DiscoveredPeer = {
          publicKey: payload.length >= 33 ? payload.slice(0, 33) : payload,
          medium: "WEBSOCKET",
          discoveredAt: now,
        };

        const isDuplicate = this.discoveredPeers.some(
          (p) =>
            p.publicKey &&
            peer.publicKey &&
            arrayEqual(p.publicKey, peer.publicKey)
        );

        if (!isDuplicate) {
          this.discoveredPeers.push(peer);

          this.emit({
            type: "PEER_DISCOVERED",
            peer,
            timestamp: now,
          });

          for (const listener of this.discoveryListeners) {
            listener(peer);
          }
        }
        break;
      }
    }
  }
}

// ─── In-Memory Bus (Node.js fallback) ─────────────────────────────

/**
 * Simple in-memory pub/sub bus for testing in Node.js environments
 * where BroadcastChannel isn't available.
 *
 * Each channel name maps to a set of listeners.
 * Messages are delivered to ALL listeners EXCEPT the sender.
 */
class InMemoryBus {
  private static channels = new Map<
    string,
    Set<(data: ArrayBuffer) => void>
  >();

  /**
   * Get a BroadcastChannel-compatible handle for an in-memory channel.
   */
  static getChannel(
    name: string,
    onMessage: (data: ArrayBuffer) => void
  ): BroadcastChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new Set());
    }

    const listeners = this.channels.get(name)!;
    listeners.add(onMessage);

    // Return a duck-typed BroadcastChannel
    return {
      name,
      postMessage(data: ArrayBuffer) {
        // Deliver to all OTHER listeners (not self)
        for (const listener of listeners) {
          if (listener !== onMessage) {
            // Async delivery to simulate real broadcast
            queueMicrotask(() => listener(data));
          }
        }
      },
      close() {
        listeners.delete(onMessage);
        if (listeners.size === 0) {
          InMemoryBus.channels.delete(name);
        }
      },
      onmessage: null,
      onmessageerror: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as BroadcastChannel;
  }

  /**
   * Reset all channels (useful for tests).
   */
  static reset(): void {
    this.channels.clear();
  }
}

export { InMemoryBus };

// ─── Utility ───────────────────────────────────────────────────────

function arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
