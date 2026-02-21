import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  writable: true,
});

import { ChannelManager } from "../src/primitives/channel-manager.js";
import { ChannelError, MAX_BONDS_PER_CELL } from "../src/interfaces/channel.js";
import { WebCryptoIdentityProvider } from "../src/backends/webcrypto-identity.js";
import { BroadcastChannelTransport, InMemoryBus } from "../src/transports/websocket.js";
import type { CompressedPublicKey, NodeId, Normalized, UnixTimestamp } from "../src/types/branded.js";

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function makeNode(channelName: string) {
  const identity = new WebCryptoIdentityProvider();
  await identity.generateKeypair();

  const transport = new BroadcastChannelTransport(channelName);
  await transport.configure({ medium: "WEBSOCKET", mtu: 65535 });
  transport.setLocalIdentity(identity.getCompressedPublicKey());

  const channel = new ChannelManager(identity, transport);
  return { identity, transport, channel };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("ChannelManager", () => {
  afterEach(() => {
    InMemoryBus.reset();
  });

  describe("constructor", () => {
    it("accepts IIdentityProvider and ITransport", async () => {
      const { channel } = await makeNode("test-cm-1");
      expect(channel).toBeInstanceOf(ChannelManager);
      channel.destroy();
    });
  });

  describe("K4 topology", () => {
    it("enforces Tetrahedron (K4) limit of 4", () => {
      expect(MAX_BONDS_PER_CELL).toBe(4);
    });
  });

  describe("initiate() + accept() — full bond negotiation", () => {
    it("completes 5-phase handshake between two nodes", async () => {
      const mesh = "test-cm-bond-1";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      const bondFormedEvents: unknown[] = [];
      alice.channel.on("BOND_FORMED", (e) => bondFormedEvents.push(e));
      bob.channel.on("BOND_FORMED", (e) => bondFormedEvents.push(e));

      // Run initiate and accept concurrently
      const [, ] = await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      expect(alice.channel.getActiveBondCount()).toBe(1);
      expect(bob.channel.getActiveBondCount()).toBe(1);

      // Both sides emitted BOND_FORMED
      expect(bondFormedEvents.length).toBe(2);

      // Both sides have an ACTIVE bond with the peer
      const aliceBonds = alice.channel.listBonds();
      expect(aliceBonds.length).toBe(1);
      expect(aliceBonds[0]!.channel.status).toBe("ACTIVE");
      expect(aliceBonds[0]!.channel.sharedSecret.length).toBe(32);
      expect(aliceBonds[0]!.trust.tier).toBe("STRUT");

      const bobBonds = bob.channel.listBonds();
      expect(bobBonds.length).toBe(1);
      expect(bobBonds[0]!.channel.status).toBe("ACTIVE");

      // Shared secrets match (ECDH is symmetric)
      const aliceSecret = aliceBonds[0]!.channel.sharedSecret;
      const bobSecret = bobBonds[0]!.channel.sharedSecret;
      expect(Buffer.from(aliceSecret).equals(Buffer.from(bobSecret))).toBe(true);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });

    it("rejects ALREADY_BONDED on duplicate initiate", async () => {
      const mesh = "test-cm-bond-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      // Second initiate should throw ALREADY_BONDED
      await expect(alice.channel.initiate(bobPubKey)).rejects.toThrow(ChannelError);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("send() and receive()", () => {
    it("encrypts, transmits, and decrypts a message over a bond", async () => {
      const mesh = "test-cm-send-1";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const aliceBond = alice.channel.listBonds()[0]!;

      const received: unknown[] = [];
      bob.channel.receive((msg) => received.push(msg));

      const payload = new TextEncoder().encode("hello from alice");
      const now = Math.floor(Date.now() / 1000) as UnixTimestamp;

      // senderId is the *peer's* NodeId (used to look up the bond)
      await alice.channel.send({
        type: "PING",
        payload,
        timestamp: now,
        senderId: aliceBond.partner.nodeId,
      });

      // Allow async microtask delivery + decryption
      await sleep(300);

      expect(received.length).toBe(1);
      const msg = received[0] as { type: string; payload: Uint8Array };
      expect(msg.type).toBe("PING");
      expect(new TextDecoder().decode(msg.payload)).toBe("hello from alice");

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });

    it("throws BOND_NOT_FOUND for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-send-2");
      await expect(
        channel.send({
          type: "PING",
          payload: new Uint8Array(0),
          timestamp: 0 as UnixTimestamp,
          senderId: "unknown" as NodeId,
        })
      ).rejects.toThrow(ChannelError);
      channel.destroy();
    });
  });

  describe("receive()", () => {
    it("returns an unsubscribe function", async () => {
      const { channel } = await makeNode("test-cm-recv-1");
      const unsub = channel.receive(() => {});
      expect(typeof unsub).toBe("function");
      unsub();
      channel.destroy();
    });
  });

  describe("close()", () => {
    it("throws BOND_NOT_FOUND for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-close-1");
      await expect(channel.close("unknown" as NodeId)).rejects.toThrow(
        ChannelError
      );
      channel.destroy();
    });

    it("emits BOND_TERMINATED and removes bond", async () => {
      const mesh = "test-cm-close-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const terminated: unknown[] = [];
      alice.channel.on("BOND_TERMINATED", (e) => terminated.push(e));

      const aliceBond = alice.channel.listBonds()[0]!;
      await alice.channel.close(aliceBond.partner.nodeId);

      expect(alice.channel.getActiveBondCount()).toBe(0);
      expect(terminated.length).toBe(1);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("getCareScore()", () => {
    it("throws BOND_NOT_FOUND for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-care-1");
      expect(() => channel.getCareScore("unknown" as NodeId)).toThrow(
        ChannelError
      );
      channel.destroy();
    });

    it("returns initial score of 0.5 for new bonds", async () => {
      const mesh = "test-cm-care-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const aliceBond = alice.channel.listBonds()[0]!;
      const score = alice.channel.getCareScore(aliceBond.partner.nodeId);
      expect(score).toBe(0.5);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("getCareScoreComponents()", () => {
    it("throws BOND_NOT_FOUND for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-comp-1");
      expect(() =>
        channel.getCareScoreComponents("unknown" as NodeId)
      ).toThrow(ChannelError);
      channel.destroy();
    });

    it("returns all four components", async () => {
      const mesh = "test-cm-comp-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const aliceBond = alice.channel.listBonds()[0]!;
      const components = alice.channel.getCareScoreComponents(aliceBond.partner.nodeId);
      expect(components).toHaveProperty("frequency");
      expect(components).toHaveProperty("reciprocity");
      expect(components).toHaveProperty("consistency");
      expect(components).toHaveProperty("responsiveness");

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("getTrustTier()", () => {
    it("throws BOND_NOT_FOUND for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-tier-1");
      expect(() => channel.getTrustTier("unknown" as NodeId)).toThrow(
        ChannelError
      );
      channel.destroy();
    });

    it("returns STRUT for initial care score of 0.5 (hysteresis requires 0.52 to promote)", async () => {
      const mesh = "test-cm-tier-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const aliceBond = alice.channel.listBonds()[0]!;
      const tier = alice.channel.getTrustTier(aliceBond.partner.nodeId);
      expect(tier).toBe("STRUT");

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("updateCareScore() — care score recalculation", () => {
    it("emits CARE_SCORE_UPDATED on recalculation", async () => {
      const mesh = "test-cm-cs-1";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const events: unknown[] = [];
      alice.channel.on("CARE_SCORE_UPDATED", (e) => events.push(e));

      const peerId = alice.channel.listBonds()[0]!.partner.nodeId;
      alice.channel.updateCareScore(peerId);

      expect(events.length).toBe(1);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });

    it("emits BOND_TRUST_CHANGED when decay drops tier", async () => {
      const mesh = "test-cm-cs-2";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const tierEvents: { previousTier: string; currentTier: string }[] = [];
      alice.channel.on("BOND_TRUST_CHANGED", (e) => tierEvents.push(e as any));

      const peerId = alice.channel.listBonds()[0]!.partner.nodeId;

      // 14-day half-life: after 60 days of no interaction, score drops significantly
      alice.channel.updateCareScore(peerId, 60);

      expect(tierEvents.length).toBe(1);
      expect(tierEvents[0]!.previousTier).toBe("STRUT");
      expect(tierEvents[0]!.currentTier).toBe("GHOST");

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });

    it("scoreToTier maps thresholds correctly", async () => {
      const mesh = "test-cm-cs-3";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const peerId = alice.channel.listBonds()[0]!.partner.nodeId;

      // No decay → recalculated score ~0.55 (reciprocity 0.5, resp 1.0, consistency 1.0)
      // 0.55 > coherent promote threshold (0.52), so promotes to COHERENT
      alice.channel.updateCareScore(peerId, 0);
      expect(alice.channel.getTrustTier(peerId)).toBe("COHERENT");

      // After 14 days decay, score ~0.275, stays in STRUT via hysteresis (demote at 0.48)
      alice.channel.updateCareScore(peerId, 14);
      const score14 = alice.channel.getCareScore(peerId);
      expect(score14).toBeLessThan(0.5);
      expect(score14).toBeGreaterThan(0.1);
      // COHERENT demotes at 0.48, score ~0.275 drops to STRUT
      expect(alice.channel.getTrustTier(peerId)).toBe("STRUT");

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });

    it("exponential decay halves score after halfLifeDays", async () => {
      const mesh = "test-cm-cs-4";
      const alice = await makeNode(mesh);
      const bob = await makeNode(mesh);

      const bobPubKey = bob.identity.getCompressedPublicKey();
      const alicePubKey = alice.identity.getCompressedPublicKey();

      await Promise.all([
        alice.channel.initiate(bobPubKey),
        bob.channel.accept(alicePubKey),
      ]);

      const peerId = alice.channel.listBonds()[0]!.partner.nodeId;

      // Get baseline score
      alice.channel.updateCareScore(peerId, 0);
      const baseline = alice.channel.getCareScore(peerId);

      // After 14 days (half-life), score should be ~half
      alice.channel.updateCareScore(peerId, 14);
      const halfLifeScore = alice.channel.getCareScore(peerId);

      // Allow 5% tolerance for floating point
      expect(halfLifeScore).toBeCloseTo((baseline as number) / 2, 1);

      alice.channel.destroy();
      bob.channel.destroy();
      alice.transport.close();
      bob.transport.close();
    });
  });

  describe("listBonds()", () => {
    it("returns empty array when no bonds exist", async () => {
      const { channel } = await makeNode("test-cm-list-1");
      expect(channel.listBonds()).toEqual([]);
      channel.destroy();
    });
  });

  describe("getBond()", () => {
    it("returns undefined for unknown peer", async () => {
      const { channel } = await makeNode("test-cm-get-1");
      expect(channel.getBond("unknown" as NodeId)).toBeUndefined();
      channel.destroy();
    });
  });

  describe("getActiveBondCount()", () => {
    it("returns 0 when no bonds exist", async () => {
      const { channel } = await makeNode("test-cm-count-1");
      expect(channel.getActiveBondCount()).toBe(0);
      channel.destroy();
    });
  });
});
