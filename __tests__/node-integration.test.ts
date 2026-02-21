/**
 * @module __tests__/node-integration.test
 * @description Integration tests for the NodeZero orchestrator.
 *
 * Tests two NodeZero instances communicating over BroadcastChannel
 * (using the InMemoryBus fallback for Node.js).
 */

import { describe, it, expect, afterEach } from "vitest";
import { webcrypto } from "node:crypto";

// Polyfill WebCrypto for Node.js test environment
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  writable: true,
});

import { NodeZero } from "../src/node.js";
import { InMemoryBus } from "../src/transports/websocket.js";

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── NodeZero Boot ─────────────────────────────────────────────────

describe("NodeZero", () => {
  const nodes: NodeZero[] = [];

  afterEach(() => {
    for (const n of nodes) n.shutdown();
    nodes.length = 0;
    InMemoryBus.reset();
  });

  describe("boot", () => {
    it("generates identity and starts transport", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);

      const identity = await node.boot();

      expect(identity.version).toBe(1);
      expect(identity.nodeId.length).toBeGreaterThan(10);
      expect(identity.publicKey.data.length).toBe(33);
      expect(identity.hardware.provider).toBe("WEBCRYPTO");
    });

    it("returns existing identity on double boot", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);

      const id1 = await node.boot();
      const id2 = await node.boot();

      expect(id1.nodeId).toBe(id2.nodeId);
    });
  });

  describe("state management", () => {
    it("updates state axes", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);
      await node.boot();

      await node.updateState("URGENCY", 0.5);
      expect(node.getVoltage()).toBeGreaterThan(0);
      expect(node.getSpoons()).toBeLessThan(12);
    });

    it("transitions scope tier under high voltage", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);
      await node.boot();

      // Push all axes high — should drop to REFLEX
      await node.updateState("URGENCY", 0.9);
      await node.updateState("COGNITIVE", 0.9);

      expect(node.getTier()).toBe("REFLEX");
      expect(node.getSpoons()).toBeLessThanOrEqual(3);
    });

    it("stays in FULL tier at low voltage", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);
      await node.boot();

      await node.updateState("URGENCY", 0.1);
      await node.updateState("COGNITIVE", 0.05);

      expect(node.getTier()).toBe("FULL");
      expect(node.getSpoons()).toBeGreaterThanOrEqual(9);
    });
  });

  describe("peer discovery", () => {
    it("discovers peers over BroadcastChannel", async () => {
      const alice = new NodeZero({
        channelName: "test-mesh-1",
        autoDiscover: false,
      });
      const bob = new NodeZero({
        channelName: "test-mesh-1",
        autoDiscover: false,
      });
      nodes.push(alice, bob);

      await alice.boot();
      await bob.boot();

      const discovered: unknown[] = [];
      bob.onPeerDiscovered((peer) => discovered.push(peer));

      // Alice broadcasts a discovery beacon
      await alice.discover();

      // Wait for async delivery
      await sleep(100);

      expect(discovered.length).toBe(1);
    });

    it("does not discover peers on different channels", async () => {
      const alice = new NodeZero({
        channelName: "channel-a",
        autoDiscover: false,
      });
      const bob = new NodeZero({
        channelName: "channel-b",
        autoDiscover: false,
      });
      nodes.push(alice, bob);

      await alice.boot();
      await bob.boot();

      const discovered: unknown[] = [];
      bob.onPeerDiscovered((peer) => discovered.push(peer));

      await alice.discover();
      await sleep(100);

      expect(discovered.length).toBe(0);
    });
  });

  describe("bond formation", () => {
    it("forms a bond with a discovered peer", async () => {
      const alice = new NodeZero({
        channelName: "test-mesh-2",
        autoDiscover: false,
      });
      const bob = new NodeZero({
        channelName: "test-mesh-2",
        autoDiscover: false,
      });
      nodes.push(alice, bob);

      await alice.boot();
      await bob.boot();

      // Collect Bob's discovered peers
      const bobPeers: Parameters<Parameters<typeof bob.onPeerDiscovered>[0]>[0][] = [];
      bob.onPeerDiscovered((peer) => bobPeers.push(peer));

      await alice.discover();
      await sleep(100);

      expect(bobPeers.length).toBe(1);

      // Bob initiates a bond with Alice
      const bond = await bob.initiateBond(bobPeers[0]!);

      expect(bond).not.toBeNull();
      expect(bond!.status).toBe("ACTIVE");
      expect(bond!.trustTier).toBe("STRUT");
      expect(bond!.sharedSecret.length).toBe(32);
    });

    it("enforces K4 topology (max 4 bonds)", async () => {
      const hub = new NodeZero({
        channelName: "test-mesh-3",
        autoDiscover: false,
      });
      nodes.push(hub);
      await hub.boot();

      // Create 5 peers
      for (let i = 0; i < 5; i++) {
        const peer = new NodeZero({
          channelName: "test-mesh-3",
          autoDiscover: false,
        });
        nodes.push(peer);
        await peer.boot();

        const peers: Parameters<Parameters<typeof hub.onPeerDiscovered>[0]>[0][] = [];
        hub.onPeerDiscovered((p) => peers.push(p));

        await peer.discover();
        await sleep(100);

        if (peers.length > 0) {
          const bond = await hub.initiateBond(peers[peers.length - 1]!);
          if (i < 4) {
            expect(bond).not.toBeNull();
          } else {
            expect(bond).toBeNull(); // 5th bond rejected
          }
        }
      }

      expect(hub.getActiveBonds().length).toBeLessThanOrEqual(4);
    });

    it("does not bond with self", async () => {
      const node = new NodeZero({
        channelName: "test-mesh-4",
        autoDiscover: false,
      });
      nodes.push(node);
      await node.boot();

      // Simulate discovering our own beacon
      const identity = await node.identity.exportPublicKey();
      const fakePeer = {
        publicKey: identity.publicKey.data,
        medium: "WEBSOCKET" as const,
        discoveredAt: Math.floor(Date.now() / 1000) as import("../src/types/branded.js").UnixTimestamp,
      };

      const bond = await node.initiateBond(fakePeer);
      expect(bond).toBeNull();
    });

    it("emits bondFormed callback", async () => {
      const alice = new NodeZero({
        channelName: "test-mesh-5",
        autoDiscover: false,
      });
      const bob = new NodeZero({
        channelName: "test-mesh-5",
        autoDiscover: false,
      });
      nodes.push(alice, bob);

      await alice.boot();
      await bob.boot();

      const bonds: unknown[] = [];
      bob.onBondFormed((b) => bonds.push(b));

      const bobPeers: Parameters<Parameters<typeof bob.onPeerDiscovered>[0]>[0][] = [];
      bob.onPeerDiscovered((p) => bobPeers.push(p));

      await alice.discover();
      await sleep(100);

      await bob.initiateBond(bobPeers[0]!);
      expect(bonds.length).toBe(1);
    });
  });

  describe("state broadcast and receive", () => {
    it("broadcasts state to peers", async () => {
      const alice = new NodeZero({
        channelName: "test-mesh-6",
        autoDiscover: false,
        broadcastInterval: 100000, // Don't auto-broadcast during test
      });
      const bob = new NodeZero({
        channelName: "test-mesh-6",
        autoDiscover: false,
        broadcastInterval: 100000,
      });
      nodes.push(alice, bob);

      await alice.boot();
      await bob.boot();

      const received: { nodeId: string; state: { voltage: number; spoons: number; tier: string } }[] = [];
      bob.onRemoteState((nodeId, state) => {
        received.push({ nodeId, state });
      });

      // Alice updates state (which triggers a broadcast)
      await alice.updateState("URGENCY", 0.8);

      await sleep(200);

      expect(received.length).toBeGreaterThanOrEqual(1);
      expect(received[0]!.state.voltage).toBeGreaterThan(0);
    });
  });

  describe("getStatus", () => {
    it("returns a complete status summary", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);
      await node.boot();

      await node.updateState("URGENCY", 0.3);

      const status = node.getStatus();
      expect(status.nodeId.length).toBeGreaterThan(10);
      expect(typeof status.voltage).toBe("number");
      expect(typeof status.spoons).toBe("number");
      expect(typeof status.tier).toBe("string");
      expect(status.bondCount).toBe(0);
      expect(Array.isArray(status.peers)).toBe(true);
    });
  });

  describe("shutdown", () => {
    it("shuts down cleanly", async () => {
      const node = new NodeZero({ autoDiscover: false });
      nodes.push(node);
      await node.boot();

      node.shutdown();

      // After shutdown, getStatus should still work (reads local state)
      const status = node.getStatus();
      expect(status.bondCount).toBe(0);
    });
  });
});
