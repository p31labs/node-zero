/**
 * @module primitives/base-emitter
 * @description Base implementation of the typed event emitter.
 * All primitive skeleton classes extend this to gain event capabilities.
 */

import type {
  INodeZeroEmitter,
  EventListener,
} from "../interfaces/event-emitter.js";
import type {
  NodeZeroEventMap,
  NodeZeroEventType,
} from "../types/events.js";

/**
 * Concrete typed event emitter for Node Zero protocol events.
 * Uses a Map of Sets for O(1) listener registration and removal.
 */
export class NodeZeroEmitter implements INodeZeroEmitter {
  private readonly listeners = new Map<
    NodeZeroEventType,
    Set<EventListener<NodeZeroEventType>>
  >();

  on<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners
      .get(eventType)!
      .add(listener as EventListener<NodeZeroEventType>);
  }

  once<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void {
    const wrapper: EventListener<T> = (event) => {
      this.off(eventType, wrapper);
      listener(event);
    };
    this.on(eventType, wrapper);
  }

  off<T extends NodeZeroEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(listener as EventListener<NodeZeroEventType>);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  emit<T extends NodeZeroEventType>(event: NodeZeroEventMap[T]): void {
    const eventType = (event as unknown as { type: T }).type;
    const set = this.listeners.get(eventType);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }
  }
}
