/**
 * L0: synchronous typed event bus.
 *
 * Dispatch order is registration order, so the bus never introduces
 * non-determinism of its own.
 */

export type EventHandler<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class EventBus<TMap extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof TMap, Array<EventHandler<never>>>();

  on<K extends keyof TMap>(type: K, handler: EventHandler<TMap[K]>): Unsubscribe {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<never>);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type);
      if (!current) return;
      const index = current.indexOf(handler as EventHandler<never>);
      if (index >= 0) current.splice(index, 1);
    };
  }

  emit<K extends keyof TMap>(type: K, payload: TMap[K]): void {
    const list = this.handlers.get(type);
    if (!list) return;
    // Copy: a handler may unsubscribe during dispatch.
    for (const handler of list.slice()) {
      (handler as EventHandler<TMap[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
