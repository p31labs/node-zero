/**
 * @module @p31/node-zero
 * @description Node Zero Protocol — the foundational data model and
 * communication layer for P31 Labs' assistive technology ecosystem.
 *
 * Exports the four core primitives (Identity, State, Vault, Bond),
 * their interfaces, all type definitions, the event system, the
 * transport abstraction, the binary network codec, WebCrypto backend,
 * WebSocket/BroadcastChannel transport, and the NodeZero orchestrator.
 *
 * @version 0.1.0-alpha.1
 * @author P31 Labs
 * @license MIT
 */

// ─── Types ──────────────────────────────────────────────────────────
export * from "./types/index.js";

// ─── Interfaces ─────────────────────────────────────────────────────
export * from "./interfaces/index.js";

// ─── Primitives (Skeleton Classes) ──────────────────────────────────
export * from "./primitives/index.js";

// ─── Network Codec ──────────────────────────────────────────────────
export * from "./codec/index.js";

// ─── Crypto Backends ────────────────────────────────────────────────
export * from "./backends/index.js";

// ─── Transport Implementations ──────────────────────────────────────
export * from "./transports/index.js";

// ─── Orchestrator ───────────────────────────────────────────────────
export { NodeZero } from "./node.js";
export type { NodeZeroConfig } from "./node.js";

// ─── Forwarder (optional: wires node events → ledger + game) ─────────
export { wire, boot } from "./forwarder.js";
export type {
  EventSource,
  LedgerLike,
  GameLike,
  ForwarderConfig,
  ForwarderHandle,
} from "./forwarder.js";
