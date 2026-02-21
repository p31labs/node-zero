import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateEngine } from "../src/primitives/state-engine.js";
import { StateError } from "../src/interfaces/state-engine.js";
import type { NodeId, Normalized } from "../src/types/branded.js";

describe("StateEngine", () => {
  let engine: StateEngine;
  const testNodeId = "test-node-id" as NodeId;

  beforeEach(() => {
    engine = new StateEngine(testNodeId);
  });

  describe("updateAxis()", () => {
    it("should accept URGENCY values in [0.0, 1.0]", async () => {
      await engine.updateAxis("URGENCY", 0.5);
      const state = engine.getState();
      expect(state.vector.urgency).toBe(0.5);
    });

    it("should accept VALENCE values in [-1.0, +1.0]", async () => {
      await engine.updateAxis("VALENCE", -0.7);
      const state = engine.getState();
      expect(state.vector.valence).toBe(-0.7);
    });

    it("should accept COGNITIVE values in [0.0, 1.0]", async () => {
      await engine.updateAxis("COGNITIVE", 0.8);
      const state = engine.getState();
      expect(state.vector.cognitiveLoad).toBe(0.8);
    });

    it("should throw VALUE_OUT_OF_RANGE for URGENCY > 1.0", async () => {
      await expect(engine.updateAxis("URGENCY", 1.5)).rejects.toThrow(StateError);
    });

    it("should throw VALUE_OUT_OF_RANGE for VALENCE outside [-1, +1]", async () => {
      await expect(engine.updateAxis("VALENCE", -1.5)).rejects.toThrow(StateError);
    });

    it("should emit STATE_CHANGED event", async () => {
      const listener = vi.fn();
      engine.on("STATE_CHANGED", listener);
      await engine.updateAxis("URGENCY", 0.5);
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should emit SCOPE_TIER_CHANGED when tier boundary is crossed", async () => {
      const listener = vi.fn();
      engine.on("SCOPE_TIER_CHANGED", listener);
      // Push into REFLEX tier
      await engine.updateAxis("URGENCY", 0.9);
      await engine.updateAxis("COGNITIVE", 0.9);
      // Check if tier changed event was emitted
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("updateCoherence()", () => {
    it("should update the Q coherence value", async () => {
      await engine.updateCoherence(0.35 as Normalized);
      expect(engine.getCoherence().value).toBe(0.35);
    });

    it("should activate beacon near coherence point (~0.35)", async () => {
      await engine.updateCoherence(0.35 as Normalized);
      expect(engine.getCoherence().beaconActive).toBe(true);
    });

    it("should deactivate beacon outside coherence window", async () => {
      await engine.updateCoherence(0.8 as Normalized);
      expect(engine.getCoherence().beaconActive).toBe(false);
    });

    it("should emit COHERENCE_CHANGED event", async () => {
      const listener = vi.fn();
      engine.on("COHERENCE_CHANGED", listener);
      await engine.updateCoherence(0.5 as Normalized);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe("broadcast()", () => {
    it("should serialize and transmit state to bonded peers", async () => {
      // TODO: Requires ITransport mock
      await expect(engine.broadcast()).rejects.toThrow(StateError);
    });

    it("should rate-limit to one broadcast per MIN_INTERVAL", async () => {
      // TODO
    });
  });

  describe("subscribe()", () => {
    it("should return an unsubscribe function", () => {
      const unsub = engine.subscribe(() => {});
      expect(typeof unsub).toBe("function");
    });

    it("should stop receiving updates after unsubscribe", () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      // No way to trigger remote updates in unit test without mock
    });
  });

  describe("getComposite()", () => {
    it("should return voltage, spoons, and tier", () => {
      const composite = engine.getComposite();
      expect(composite).toHaveProperty("composite");
      expect(composite).toHaveProperty("spoons");
      expect(composite).toHaveProperty("tier");
      expect(composite).toHaveProperty("magnitudes");
    });

    it("should return FULL tier with low stress values", () => {
      const composite = engine.getComposite();
      expect(composite.tier).toBe("FULL");
    });

    it("should return high spoon count with low stress", () => {
      const composite = engine.getComposite();
      expect(composite.spoons).toBeGreaterThanOrEqual(9);
    });
  });

  describe("getSpoonCount()", () => {
    it("should return 12 spoons at zero stress", () => {
      expect(engine.getSpoonCount()).toBe(12);
    });

    it("should return fewer spoons as stress increases", async () => {
      await engine.updateAxis("URGENCY", 0.8);
      await engine.updateAxis("COGNITIVE", 0.8);
      expect(engine.getSpoonCount()).toBeLessThan(6);
    });

    it("should be modulated by Q coherence", async () => {
      await engine.updateAxis("URGENCY", 0.5);
      const spoonsHighQ = engine.getSpoonCount();

      await engine.updateCoherence(0.1 as Normalized);
      const spoonsLowQ = engine.getSpoonCount();

      expect(spoonsLowQ).toBeLessThanOrEqual(spoonsHighQ);
    });
  });

  describe("getCurrentTier()", () => {
    it("should return FULL at initial state", () => {
      expect(engine.getCurrentTier()).toBe("FULL");
    });

    it("should return REFLEX at high stress", async () => {
      await engine.updateAxis("URGENCY", 1.0);
      await engine.updateAxis("COGNITIVE", 1.0);
      await engine.updateAxis("VALENCE", -1.0);
      expect(engine.getCurrentTier()).toBe("REFLEX");
    });
  });

  describe("getCoherence()", () => {
    it("should return default coherence at initialization", () => {
      const q = engine.getCoherence();
      expect(q.value).toBe(0.5);
      expect(q.beaconActive).toBe(false);
    });
  });

  describe("getState()", () => {
    it("should return a complete NodeZeroState snapshot", () => {
      const state = engine.getState();
      expect(state.version).toBe(1);
      expect(state.vector).toBeDefined();
      expect(state.composite).toBeDefined();
      expect(state.coherence).toBeDefined();
      expect(state.metadata.originNodeId).toBe(testNodeId);
    });
  });
});
