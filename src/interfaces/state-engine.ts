/**
 * @module interfaces/state-engine
 * @description IStateEngine — metabolic mapping and the Digital Centaur.
 *
 * Converts complex biophysical and cognitive inputs into a unified voltage
 * vector. Tracks the operator's "metabolic currency" using Spoon Theory,
 * mapping the composite voltage to a 1–12 spoon scale that governs the
 * Scope tier (FULL / PATTERN / REFLEX).
 *
 * The state engine integrates Q coherence from the Trimtab (EC11 rotary
 * encoder) — as Q decreases, the "cost" of maintaining state axes increases,
 * creating a preventative feedback loop for burnout detection.
 */

import type {
  Axis,
  NodeZeroState,
  VoltageVector,
  StateUpdateCallback,
  ScopeTier,
  QCoherence,
} from "../types/state.js";
import type { Normalized } from "../types/branded.js";

/**
 * Errors that may be thrown by IStateEngine operations.
 */
export class StateError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_AXIS"
      | "VALUE_OUT_OF_RANGE"
      | "BROADCAST_FAILED"
      | "ENGINE_NOT_INITIALIZED"
  ) {
    super(message);
    this.name = "StateError";
  }
}

/**
 * @interface IStateEngine
 * @description Manages the high-dimensional state vector of the node.
 * Implements the "Metabolic Currency" model for energy pacing.
 */
export interface IStateEngine {
  // ─── Commands ───────────────────────────────────────────────────

  /**
   * @command
   * @description Updates a single dimension of the state vector.
   * Primary method for sensors (heart rate monitors, accelerometers)
   * to inject data into the system.
   *
   * @param axis - The dimension to update (URGENCY, VALENCE, COGNITIVE).
   * @param value - The new normalized value.
   *   URGENCY/COGNITIVE: [0.0, 1.0]
   *   VALENCE: [-1.0, +1.0]
   * @postcondition Emits STATE_CHANGED if delta exceeds sensitivity threshold.
   *               May trigger SCOPE_TIER_CHANGED if tier boundary is crossed.
   * @throws {StateError} code=VALUE_OUT_OF_RANGE if value outside valid bounds.
   */
  updateAxis(axis: Axis, value: number): Promise<void>;

  /**
   * @command
   * @description Updates the Q coherence value (from Trimtab hardware input).
   *
   * @param value - The Q coherence value [0.0, 1.0].
   * @postcondition May activate/deactivate coherence beacon (threshold ≈ 0.35).
   *               Emits COHERENCE_CHANGED event.
   */
  updateCoherence(value: Normalized): Promise<void>;

  /**
   * @command
   * @description Serializes the current state and transmits it to all
   * identities with an active state-sync Bond permission.
   *
   * Rate limited: max one broadcast per MIN_INTERVAL (default 5 seconds).
   *
   * @postcondition Encrypted state fragments queued in ITransport.
   * @throws {StateError} code=BROADCAST_FAILED if transport layer unavailable.
   */
  broadcast(): Promise<void>;

  /**
   * @command
   * @description Subscribes to state updates from bonded peers.
   *
   * @param callback - Function invoked when a bonded peer broadcasts a state change.
   * @returns Unsubscribe function.
   */
  subscribe(callback: StateUpdateCallback): () => void;

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * @query
   * @description Calculates the current multi-dimensional voltage vector.
   *
   * @returns Per-axis magnitudes, composite voltage, spoon count, and scope tier.
   */
  getComposite(): VoltageVector;

  /**
   * @query
   * @description Maps the current voltage vector and Q coherence to
   * the 1–12 spoon scale.
   *
   * As Q coherence decreases, the cost of maintaining state axes increases,
   * leading to faster spoon depletion (preventative feedback loop).
   *
   * | Voltage (φ) | Spoons | Scope Tier |
   * |-------------|--------|------------|
   * | 0.00–0.25   | 9–12   | FULL       |
   * | 0.26–0.60   | 4–8    | PATTERN    |
   * | 0.61–1.00   | 0–3    | REFLEX     |
   *
   * @returns Integer spoon count (1–12). 12 = peak; 1 = emergency.
   */
  getSpoonCount(): number;

  /**
   * @query
   * @description Returns the current scope tier.
   */
  getCurrentTier(): ScopeTier;

  /**
   * @query
   * @description Returns the current Q coherence state.
   */
  getCoherence(): QCoherence;

  /**
   * @query
   * @description Returns the full current state snapshot.
   */
  getState(): NodeZeroState;
}
