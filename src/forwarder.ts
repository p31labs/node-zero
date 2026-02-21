/**
 * @module node-zero/forwarder
 * @description Auto-forwarder that wires NodeZero protocol events to
 * @p31/love-ledger and @p31/game-engine automatically.
 *
 * Without the forwarder, every consumer writes this:
 *   node.on("BOND_FORMED", e => ledger.ingest("BOND_FORMED", e));
 *   node.on("PEER_DISCOVERED", e => ledger.ingest("PEER_DISCOVERED", e));
 *   // ... 6+ lines
 *
 * With the forwarder:
 *   const stack = boot(node, { ledger: true, game: { domeName: "My Dome" } });
 *   // Done. Everything flows.
 *
 * The forwarder is optional. NodeZero works without it. LedgerEngine works
 * without it. GameEngine works without it. The forwarder just removes the
 * repeated wiring pattern.
 *
 * Designed so that love-ledger and game-engine remain optional peer
 * dependencies. The forwarder accepts pre-constructed instances or
 * configuration objects to construct them.
 */

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Minimal event emitter interface — matches NodeZero's event shape.
 * We don't import NodeZero types to keep this module dependency-free.
 */
export interface EventSource {
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
}

/**
 * Minimal LedgerEngine interface — matches @p31/love-ledger.
 */
export interface LedgerLike {
  ingest(eventType: string, payload: unknown): unknown;
  blockPlaced(meta?: Record<string, unknown>): unknown;
  donate(amount: number, meta?: Record<string, unknown>): unknown;
  readonly wallet: { totalEarned: number; sovereigntyPool: number; availableBalance: number };
  readonly transactions: readonly unknown[];
  export(): unknown;
  import(snapshot: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
}

/**
 * Minimal GameEngine interface — matches @p31/game-engine.
 */
export interface GameLike {
  bondFormed(peerId: string): void;
  loveEarned(amount: number): void;
  readonly player: { xp: number; level: number; tier: string; buildStreak: number };
  readonly dome: { rigidity: { coherence: number; isRigid: boolean } };
  export(): unknown;
  import(snapshot: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
}

/**
 * Protocol events that the forwarder listens for.
 * These are the events NodeZero emits during normal operation.
 */
const LEDGER_EVENTS = [
  "BOND_FORMED",
  "PEER_DISCOVERED",
  "TRANSMIT_COMPLETE",
  "REMOTE_STATE_RECEIVED",
  "VAULT_LAYER_CREATED",
  "COHERENCE_CHANGED",
  "STATE_CHANGED",
  "BOND_TRUST_CHANGED",
  "CARE_SCORE_UPDATED",
] as const;

const GAME_EVENTS = [
  "BOND_FORMED",
] as const;

// ─── Forwarder ──────────────────────────────────────────────────────

/**
 * Configuration for the auto-forwarder.
 */
export interface ForwarderConfig {
  /** Pre-constructed LedgerEngine instance, or false to skip */
  ledger?: LedgerLike | false;
  /** Pre-constructed GameEngine instance, or false to skip */
  game?: GameLike | false;
  /** Whether to forward ledger LOVE_EARNED events to game.loveEarned() */
  bridgeLoveToGame?: boolean;
}

/**
 * Active forwarding handles — used for cleanup.
 */
export interface ForwarderHandle {
  /** Pre-bound event handlers for cleanup */
  readonly handlers: ReadonlyArray<{ event: string; handler: (data: unknown) => void }>;
  /** Tear down all forwarding */
  teardown(): void;
  /** The wired ledger instance (if any) */
  readonly ledger: LedgerLike | null;
  /** The wired game instance (if any) */
  readonly game: GameLike | null;
}

/**
 * Wire a NodeZero event source to a LedgerEngine and/or GameEngine.
 *
 * @param source - The NodeZero instance (or any EventSource)
 * @param config - Which subsystems to wire
 * @returns A handle with teardown() for cleanup
 *
 * @example
 * ```ts
 * import { NodeZero } from "@p31/node-zero";
 * import { LedgerEngine } from "@p31/love-ledger";
 * import { GameEngine } from "@p31/game-engine";
 * import { wire } from "@p31/node-zero/forwarder";
 *
 * const node = new NodeZero({ ... });
 * const ledger = new LedgerEngine(nodeId);
 * const game = new GameEngine(nodeId, {
 *   domeName: "Crystal Dome",
 *   ledger: {
 *     blockPlaced: (meta) => ledger.blockPlaced(meta),
 *     challengeComplete: (id, love) => ledger.donate(love, { challengeId: id }),
 *   },
 * });
 *
 * const handle = wire(node, { ledger, game, bridgeLoveToGame: true });
 *
 * // All events now flow automatically:
 * // node events → ledger.ingest()
 * // BOND_FORMED → game.bondFormed()
 * // ledger LOVE_EARNED → game.loveEarned()
 *
 * // Cleanup:
 * handle.teardown();
 * ```
 */
export function wire(source: EventSource, config: ForwarderConfig = {}): ForwarderHandle {
  const ledger: LedgerLike | null = (config.ledger === false ? null : config.ledger ?? null);
  const game: GameLike | null = (config.game === false ? null : config.game ?? null);
  const bridgeLove = config.bridgeLoveToGame !== false;

  const handlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

  // ── Ledger forwarding ───────────────────────────────────────────

  if (ledger) {
    for (const event of LEDGER_EVENTS) {
      const handler = (data: unknown) => {
        ledger.ingest(event, data);
      };
      source.on(event, handler);
      handlers.push({ event, handler });
    }
  }

  // ── Game forwarding ─────────────────────────────────────────────

  if (game) {
    for (const event of GAME_EVENTS) {
      if (event === "BOND_FORMED") {
        const handler = (data: unknown) => {
          const payload = data as { peerId?: string; bond?: { peerId?: string } };
          const peerId = payload?.peerId ?? payload?.bond?.peerId ?? "unknown";
          game.bondFormed(peerId);
        };
        source.on(event, handler);
        handlers.push({ event, handler });
      }
    }
  }

  // ── Bridge: Ledger → Game ───────────────────────────────────────

  if (ledger && game && bridgeLove) {
    const loveHandler = (tx: unknown) => {
      const t = tx as { amount?: number };
      if (t?.amount != null) {
        game.loveEarned(t.amount);
      }
    };
    ledger.on("LOVE_EARNED", loveHandler);
    // Store with a special key for teardown
    handlers.push({ event: "__LEDGER:LOVE_EARNED", handler: loveHandler });
  }

  // ── Handle ──────────────────────────────────────────────────────

  return {
    handlers,
    ledger,
    game,
    teardown() {
      for (const { event, handler } of handlers) {
        if (event.startsWith("__LEDGER:")) {
          // These are on the ledger, not the source
          const ledgerEvent = event.replace("__LEDGER:", "");
          ledger?.off(ledgerEvent, handler);
        } else {
          source.off(event, handler);
        }
      }
    },
  };
}

// ─── Boot (convenience) ─────────────────────────────────────────────

/**
 * High-level convenience: given a node and its ID, construct the full
 * stack and wire everything. Returns the handle plus the constructed
 * ledger and game instances.
 *
 * This is the "one function" version for consumers who want the simplest
 * possible setup. For more control, use wire() directly.
 *
 * @example
 * ```ts
 * import { boot } from "@p31/node-zero/forwarder";
 * import { LedgerEngine } from "@p31/love-ledger";
 * import { GameEngine } from "@p31/game-engine";
 *
 * // Consumer constructs the instances they want:
 * const ledger = new LedgerEngine(nodeId);
 * const game = new GameEngine(nodeId, {
 *   domeName: "Crystal Dome",
 *   ledger: {
 *     blockPlaced: (m) => ledger.blockPlaced(m),
 *     challengeComplete: (id, love) => ledger.donate(love, { challengeId: id }),
 *   },
 * });
 *
 * const stack = boot(node, { ledger, game });
 * // Everything is wired. stack.teardown() to clean up.
 * ```
 */
export function boot(
  source: EventSource,
  config: ForwarderConfig
): ForwarderHandle {
  return wire(source, config);
}
