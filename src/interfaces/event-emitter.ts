/**
 * @module interfaces/event-emitter
 * @description Typed event emitter interface for Node Zero's reactive system.
 *
 * All primitives implement INodeZeroEmitter to emit typed events.
 * The event map ensures that listeners receive correctly-typed payloads
 * without runtime type checking.
 */

import type { NodeZeroEventMap, NodeZeroEventType } from "../types/events.js";

/**
 * Listener function signature for a specific event type.
 */
export type EventListener<T extends NodeZeroEventType> = (
  event: NodeZeroEventMap[T]
) => void;

/**
 * @interface INodeZeroEmitter
 * @description Typed event emitter for Node Zero protocol events.
 * Provides compile-time safety for event names and payload types.
 */
export interface INodeZeroEmitter {
  /**
   * Register a listener for a specific event type.
   * @param eventType - The event type to listen for.
   * @param listener - Callback function receiving the typed event payload.
   */
  on<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void;

  /**
   * Register a one-time listener that auto-removes after first invocation.
   * @param eventType - The event type to listen for.
   * @param listener - Callback function receiving the typed event payload.
   */
  once<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void;

  /**
   * Remove a previously registered listener.
   * @param eventType - The event type the listener was registered for.
   * @param listener - The listener function to remove.
   */
  off<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void;

  /**
   * Emit an event, invoking all registered listeners synchronously.
   * @param event - The typed event object to emit.
   */
  emit<T extends NodeZeroEventType>(event: NodeZeroEventMap[T]): void;
}
