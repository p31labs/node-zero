/**
 * @module __tests__/forwarder.test
 * @description Tests for the auto-forwarder (wire, boot, teardown, ledger/game bridging).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { wire, boot } from "../src/forwarder.js";
import type { EventSource, LedgerLike, GameLike } from "../src/forwarder.js";

// ─── Mock EventSource (simulates NodeZero) ──────────────────────────

class MockSource implements EventSource {
  private _listeners = new Map<string, Set<(data: unknown) => void>>();

  on(event: string, handler: (data: unknown) => void): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event: string, data: unknown): void {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ─── Mock LedgerEngine ──────────────────────────────────────────────

class MockLedger implements LedgerLike {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private _listeners = new Map<string, Set<(data: unknown) => void>>();

  ingest(eventType: string, payload: unknown): unknown {
    this.calls.push({ method: "ingest", args: [eventType, payload] });
    // Simulate LOVE_EARNED emission
    this._emit("LOVE_EARNED", { type: eventType, amount: 10 });
    return { type: eventType, amount: 10 };
  }

  blockPlaced(meta?: Record<string, unknown>): unknown {
    this.calls.push({ method: "blockPlaced", args: [meta] });
    return { type: "BLOCK_PLACED", amount: 1 };
  }

  donate(amount: number, meta?: Record<string, unknown>): unknown {
    this.calls.push({ method: "donate", args: [amount, meta] });
    return { type: "DONATION", amount };
  }

  get wallet() {
    return { totalEarned: 100, sovereigntyPool: 50, availableBalance: 50 };
  }
  get transactions() {
    return [];
  }
  export(): unknown {
    return {};
  }
  import(_s: unknown): void {}

  on(event: string, handler: (data: unknown) => void): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    this._listeners.get(event)?.delete(handler);
  }

  private _emit(event: string, data: unknown): void {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ─── Mock GameEngine ────────────────────────────────────────────────

class MockGame implements GameLike {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private _listeners = new Map<string, Set<(data: unknown) => void>>();

  bondFormed(peerId: string): void {
    this.calls.push({ method: "bondFormed", args: [peerId] });
  }
  loveEarned(amount: number): void {
    this.calls.push({ method: "loveEarned", args: [amount] });
  }

  get player() {
    return { xp: 0, level: 0, tier: "seedling", buildStreak: 0 };
  }
  get dome() {
    return { rigidity: { coherence: 1.0, isRigid: true } };
  }
  export(): unknown {
    return {};
  }
  import(_s: unknown): void {}

  on(event: string, handler: (data: unknown) => void): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    this._listeners.get(event)?.delete(handler);
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ═════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════

describe("wire()", () => {
  let source: MockSource;
  let ledger: MockLedger;
  let game: MockGame;

  beforeEach(() => {
    source = new MockSource();
    ledger = new MockLedger();
    game = new MockGame();
  });

  // ── Ledger forwarding ───────────────────────────────────────────

  describe("Ledger forwarding", () => {
    it("forwards BOND_FORMED to ledger.ingest", () => {
      wire(source, { ledger });
      source.emit("BOND_FORMED", { peerId: "abc" });
      expect(ledger.calls).toContainEqual({
        method: "ingest",
        args: ["BOND_FORMED", { peerId: "abc" }],
      });
    });

    it("forwards PEER_DISCOVERED", () => {
      wire(source, { ledger });
      source.emit("PEER_DISCOVERED", { nodeId: "xyz" });
      expect(ledger.calls.some(c => c.args[0] === "PEER_DISCOVERED")).toBe(true);
    });

    it("forwards TRANSMIT_COMPLETE", () => {
      wire(source, { ledger });
      source.emit("TRANSMIT_COMPLETE", {});
      expect(ledger.calls.some(c => c.args[0] === "TRANSMIT_COMPLETE")).toBe(true);
    });

    it("forwards REMOTE_STATE_RECEIVED", () => {
      wire(source, { ledger });
      source.emit("REMOTE_STATE_RECEIVED", { state: {} });
      expect(ledger.calls.some(c => c.args[0] === "REMOTE_STATE_RECEIVED")).toBe(true);
    });

    it("forwards VAULT_LAYER_CREATED", () => {
      wire(source, { ledger });
      source.emit("VAULT_LAYER_CREATED", { layer: "medical" });
      expect(ledger.calls.some(c => c.args[0] === "VAULT_LAYER_CREATED")).toBe(true);
    });

    it("forwards COHERENCE_CHANGED", () => {
      wire(source, { ledger });
      source.emit("COHERENCE_CHANGED", { coherence: 0.75 });
      expect(ledger.calls.some(c => c.args[0] === "COHERENCE_CHANGED")).toBe(true);
    });

    it("forwards STATE_CHANGED", () => {
      wire(source, { ledger });
      source.emit("STATE_CHANGED", { voltage: 0.2 });
      expect(ledger.calls.some(c => c.args[0] === "STATE_CHANGED")).toBe(true);
    });

    it("forwards BOND_TRUST_CHANGED", () => {
      wire(source, { ledger });
      source.emit("BOND_TRUST_CHANGED", { tier: "COHERENT" });
      expect(ledger.calls.some(c => c.args[0] === "BOND_TRUST_CHANGED")).toBe(true);
    });

    it("forwards CARE_SCORE_UPDATED", () => {
      wire(source, { ledger });
      source.emit("CARE_SCORE_UPDATED", { score: 0.8 });
      expect(ledger.calls.some(c => c.args[0] === "CARE_SCORE_UPDATED")).toBe(true);
    });

    it("forwards all 9 protocol events", () => {
      wire(source, { ledger });
      const events = [
        "BOND_FORMED",
        "PEER_DISCOVERED",
        "TRANSMIT_COMPLETE",
        "REMOTE_STATE_RECEIVED",
        "VAULT_LAYER_CREATED",
        "COHERENCE_CHANGED",
        "STATE_CHANGED",
        "BOND_TRUST_CHANGED",
        "CARE_SCORE_UPDATED",
      ];
      events.forEach(e => source.emit(e, {}));
      expect(ledger.calls.filter(c => c.method === "ingest")).toHaveLength(9);
    });

    it("does not forward unknown events", () => {
      wire(source, { ledger });
      source.emit("UNKNOWN_EVENT", {});
      expect(ledger.calls).toHaveLength(0);
    });
  });

  // ── Game forwarding ─────────────────────────────────────────────

  describe("Game forwarding", () => {
    it("forwards BOND_FORMED to game.bondFormed", () => {
      wire(source, { game });
      source.emit("BOND_FORMED", { peerId: "abc" });
      expect(game.calls).toContainEqual({ method: "bondFormed", args: ["abc"] });
    });

    it("extracts peerId from bond.peerId", () => {
      wire(source, { game });
      source.emit("BOND_FORMED", { bond: { peerId: "nested" } });
      expect(game.calls).toContainEqual({ method: "bondFormed", args: ["nested"] });
    });

    it("uses 'unknown' when peerId not found", () => {
      wire(source, { game });
      source.emit("BOND_FORMED", {});
      expect(game.calls).toContainEqual({ method: "bondFormed", args: ["unknown"] });
    });
  });

  // ── Bridge: Ledger → Game ───────────────────────────────────────

  describe("Love bridge (ledger → game)", () => {
    it("bridges LOVE_EARNED to game.loveEarned", () => {
      wire(source, { ledger, game, bridgeLoveToGame: true });
      source.emit("BOND_FORMED", { peerId: "x" }); // triggers ledger → LOVE_EARNED
      expect(game.calls.some(c => c.method === "loveEarned")).toBe(true);
    });

    it("bridge is on by default", () => {
      wire(source, { ledger, game });
      source.emit("PEER_DISCOVERED", { nodeId: "y" });
      expect(game.calls.some(c => c.method === "loveEarned")).toBe(true);
    });

    it("bridge can be disabled", () => {
      wire(source, { ledger, game, bridgeLoveToGame: false });
      source.emit("BOND_FORMED", { peerId: "x" });
      expect(game.calls.filter(c => c.method === "loveEarned")).toHaveLength(0);
    });
  });

  // ── Teardown ────────────────────────────────────────────────────

  describe("Teardown", () => {
    it("removes all source listeners on teardown", () => {
      const handle = wire(source, { ledger, game });
      expect(source.listenerCount("BOND_FORMED")).toBeGreaterThan(0);
      handle.teardown();
      expect(source.listenerCount("BOND_FORMED")).toBe(0);
    });

    it("removes ledger bridge listener on teardown", () => {
      const handle = wire(source, { ledger, game });
      expect(ledger.listenerCount("LOVE_EARNED")).toBe(1);
      handle.teardown();
      expect(ledger.listenerCount("LOVE_EARNED")).toBe(0);
    });

    it("events no longer forwarded after teardown", () => {
      const handle = wire(source, { ledger });
      handle.teardown();
      source.emit("BOND_FORMED", { peerId: "abc" });
      expect(ledger.calls).toHaveLength(0);
    });
  });

  // ── Partial wiring ─────────────────────────────────────────────

  describe("Partial wiring", () => {
    it("ledger only (no game)", () => {
      const handle = wire(source, { ledger });
      source.emit("BOND_FORMED", { peerId: "x" });
      expect(ledger.calls.length).toBeGreaterThan(0);
      expect(handle.game).toBeNull();
    });

    it("game only (no ledger)", () => {
      const handle = wire(source, { game });
      source.emit("BOND_FORMED", { peerId: "x" });
      expect(game.calls.length).toBeGreaterThan(0);
      expect(handle.ledger).toBeNull();
    });

    it("neither (no-op)", () => {
      const handle = wire(source, {});
      source.emit("BOND_FORMED", {});
      expect(handle.handlers).toHaveLength(0);
    });

    it("ledger: false skips ledger", () => {
      const handle = wire(source, { ledger: false, game });
      source.emit("BOND_FORMED", { peerId: "x" });
      expect(handle.ledger).toBeNull();
      expect(game.calls.length).toBeGreaterThan(0);
    });
  });

  // ── Handle properties ──────────────────────────────────────────

  describe("Handle properties", () => {
    it("exposes ledger and game instances", () => {
      const handle = wire(source, { ledger, game });
      expect(handle.ledger).toBe(ledger);
      expect(handle.game).toBe(game);
    });

    it("exposes handler count", () => {
      const handle = wire(source, { ledger, game });
      // 9 ledger events + 1 game event + 1 love bridge = 11
      expect(handle.handlers.length).toBe(11);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// boot() convenience function
// ═════════════════════════════════════════════════════════════════════

describe("boot()", () => {
  it("is an alias for wire()", () => {
    const source = new MockSource();
    const ledger = new MockLedger();
    const handle = boot(source, { ledger });
    source.emit("BOND_FORMED", {});
    expect(ledger.calls.length).toBeGreaterThan(0);
    handle.teardown();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Integration: Full stack flow
// ═════════════════════════════════════════════════════════════════════

describe("Integration: Full stack flow", () => {
  it("simulates a complete protocol session", () => {
    const source = new MockSource();
    const ledger = new MockLedger();
    const game = new MockGame();

    const handle = wire(source, { ledger, game });

    // 1. Peer discovered
    source.emit("PEER_DISCOVERED", { nodeId: "peer-1" });
    expect(ledger.calls.some(c => c.args[0] === "PEER_DISCOVERED")).toBe(true);

    // 2. Bond formed
    source.emit("BOND_FORMED", { peerId: "peer-1" });
    expect(ledger.calls.some(c => c.args[0] === "BOND_FORMED")).toBe(true);
    expect(
      game.calls.some(c => c.method === "bondFormed" && c.args[0] === "peer-1")
    ).toBe(true);

    // 3. State exchange
    source.emit("TRANSMIT_COMPLETE", { to: "peer-1" });
    source.emit("REMOTE_STATE_RECEIVED", { from: "peer-1", state: {} });

    // 4. Vault creation
    source.emit("VAULT_LAYER_CREATED", { layer: "medical" });

    // 5. Coherence spike
    source.emit("COHERENCE_CHANGED", { coherence: 0.75 });

    // 6. Trust promotion
    source.emit("BOND_TRUST_CHANGED", { peerId: "peer-1", tier: "COHERENT" });

    // 7. Care score update
    source.emit("CARE_SCORE_UPDATED", { score: 0.82 });

    // All 8 events forwarded to ledger
    const ingestCalls = ledger.calls.filter(c => c.method === "ingest");
    expect(ingestCalls).toHaveLength(8);

    // Game got the bond + love bridge events
    expect(game.calls.some(c => c.method === "bondFormed")).toBe(true);
    expect(game.calls.filter(c => c.method === "loveEarned").length).toBeGreaterThan(0);

    // Teardown
    handle.teardown();
    const prevCount = ledger.calls.length;
    source.emit("BOND_FORMED", {});
    expect(ledger.calls.length).toBe(prevCount); // No new calls
  });
});
