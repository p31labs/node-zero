/**
 * @module primitives/state-engine
 * @description Skeleton implementation of the IStateEngine interface.
 *
 * Provides the structural scaffolding for metabolic state management,
 * including voltage calculation, spoon mapping, scope tier transitions,
 * and Q coherence tracking from the Trimtab.
 */

import { NodeZeroEmitter } from "./base-emitter.js";
import type { IStateEngine } from "../interfaces/state-engine.js";
import { StateError } from "../interfaces/state-engine.js";
import type {
  Axis,
  NodeZeroState,
  VoltageVector,
  StateUpdateCallback,
  ScopeTier,
  QCoherence,
  StateVector,
  StateComposite,
} from "../types/state.js";
import type { Normalized, SignedNormalized, NodeId, UnixTimestamp } from "../types/branded.js";

/**
 * Minimum interval between state broadcasts (seconds).
 */
const MIN_BROADCAST_INTERVAL = 5;

/**
 * Default state TTL (seconds) before a peer is considered offline.
 */
const DEFAULT_STATE_TTL = 300;

/**
 * Scope tier voltage thresholds.
 */
const TIER_THRESHOLDS = {
  FULL_MAX: 0.25,
  PATTERN_MAX: 0.60,
} as const;

/**
 * StateEngine — metabolic mapping and Digital Centaur state management.
 *
 * @example
 * ```ts
 * const engine = new StateEngine(myNodeId);
 * await engine.updateAxis("URGENCY", 0.3);
 * await engine.updateAxis("COGNITIVE", 0.7);
 * const spoons = engine.getSpoonCount(); // e.g., 5
 * console.log(engine.getCurrentTier()); // "PATTERN"
 * ```
 */
export class StateEngine extends NodeZeroEmitter implements IStateEngine {
  private vector: StateVector = {
    urgency: 0 as Normalized,
    valence: 0 as SignedNormalized,
    cognitiveLoad: 0 as Normalized,
  };

  private coherence: QCoherence = {
    value: 0.5 as Normalized,
    beaconActive: false,
  };

  private lastBroadcastTime = 0;
  private subscribers: Set<StateUpdateCallback> = new Set();

  constructor(private readonly nodeId: NodeId) {
    super();
  }

  // ─── Commands ───────────────────────────────────────────────────

  async updateAxis(axis: Axis, value: number): Promise<void> {
    // Validate range
    if (axis === "VALENCE") {
      if (value < -1.0 || value > 1.0) {
        throw new StateError(
          `VALENCE must be in [-1.0, +1.0], got ${value}`,
          "VALUE_OUT_OF_RANGE"
        );
      }
    } else {
      if (value < 0.0 || value > 1.0) {
        throw new StateError(
          `${axis} must be in [0.0, 1.0], got ${value}`,
          "VALUE_OUT_OF_RANGE"
        );
      }
    }

    const previousTier = this.getCurrentTier();

    // Update the appropriate axis
    switch (axis) {
      case "URGENCY":
        this.vector = { ...this.vector, urgency: value as Normalized };
        break;
      case "VALENCE":
        this.vector = { ...this.vector, valence: value as SignedNormalized };
        break;
      case "COGNITIVE":
        this.vector = { ...this.vector, cognitiveLoad: value as Normalized };
        break;
    }

    // Check for scope tier transition
    const currentTier = this.getCurrentTier();
    if (currentTier !== previousTier) {
      this.emit({
        type: "SCOPE_TIER_CHANGED",
        previousTier,
        currentTier,
        spoons: this.getSpoonCount(),
        timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
      });
    }

    this.emit({
      type: "STATE_CHANGED",
      state: this.getState(),
      delta: Math.abs(value),
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
    });
  }

  async updateCoherence(value: Normalized): Promise<void> {
    const beaconActive = value >= 0.3 && value <= 0.4; // Near coherence point ~0.35
    this.coherence = { value, beaconActive };

    this.emit({
      type: "COHERENCE_CHANGED",
      qValue: value,
      beaconActive,
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
    });
  }

  async broadcast(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (now - this.lastBroadcastTime < MIN_BROADCAST_INTERVAL) {
      return; // Rate limited
    }
    this.lastBroadcastTime = now;

    // TODO: Serialize state to 105-byte wire format
    // compact_identity (34) || state_data (7) || signature (64)
    // Queue in ITransport for mesh broadcast
    throw new StateError(
      "broadcast() not yet implemented — requires ITransport",
      "BROADCAST_FAILED"
    );
  }

  subscribe(callback: StateUpdateCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ─── Queries ────────────────────────────────────────────────────

  getComposite(): VoltageVector {
    const voltage = this.calculateVoltage();
    const spoons = this.voltageToSpoons(voltage);
    const tier = this.spoonsToTier(spoons);

    return {
      magnitudes: {
        URGENCY: this.vector.urgency,
        VALENCE: Math.abs(this.vector.valence) as Normalized,
        COGNITIVE: this.vector.cognitiveLoad,
      },
      composite: voltage,
      spoons,
      tier,
    };
  }

  getSpoonCount(): number {
    const voltage = this.calculateVoltage();
    return this.voltageToSpoons(voltage);
  }

  getCurrentTier(): ScopeTier {
    const voltage = this.calculateVoltage();
    const spoons = this.voltageToSpoons(voltage);
    return this.spoonsToTier(spoons);
  }

  getCoherence(): QCoherence {
    return { ...this.coherence };
  }

  getState(): NodeZeroState {
    const composite = this.getComposite();
    return {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000) as UnixTimestamp,
      vector: { ...this.vector },
      composite: {
        voltage: composite.composite,
        spoons: composite.spoons,
        tier: composite.tier,
      },
      coherence: { ...this.coherence },
      metadata: {
        ttl: DEFAULT_STATE_TTL,
        originNodeId: this.nodeId,
      },
    };
  }

  // ─── Internal Calculations ──────────────────────────────────────

  /**
   * Calculate composite voltage from the three-axis vector.
   * Accounts for Q coherence: lower Q = higher effective voltage (faster depletion).
   */
  private calculateVoltage(): Normalized {
    const { urgency, cognitiveLoad } = this.vector;
    // Negative valence contributes to stress; positive reduces it
    const valenceStress = Math.max(0, -this.vector.valence);

    // Base voltage: weighted average of stress factors
    const baseVoltage =
      0.4 * (urgency as number) +
      0.35 * (cognitiveLoad as number) +
      0.25 * valenceStress;

    // Q coherence modulates voltage: low Q amplifies stress
    const qModifier = 1.0 + (1.0 - (this.coherence.value as number)) * 0.3;
    const voltage = Math.min(1.0, baseVoltage * qModifier);

    return voltage as Normalized;
  }

  /**
   * Map voltage to spoon count (1–12).
   * Linear inverse mapping.
   */
  private voltageToSpoons(voltage: Normalized): number {
    const v = voltage as number;
    return Math.max(1, Math.min(12, Math.round(12 - v * 11)));
  }

  /**
   * Map spoon count to scope tier.
   */
  private spoonsToTier(spoons: number): ScopeTier {
    if (spoons >= 9) return "FULL";
    if (spoons >= 4) return "PATTERN";
    return "REFLEX";
  }
}
