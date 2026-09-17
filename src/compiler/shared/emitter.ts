/** A map of event name → payload. */
export type EventMap = object;

export interface EventEmitter<Events extends EventMap> {
  on<K extends keyof Events & string>(event: K, listener: (payload: Events[K]) => void): () => void;
  off<K extends keyof Events & string>(event: K, listener: (payload: Events[K]) => void): void;
  emit<K extends keyof Events & string>(event: K, payload: Events[K]): void;
  clear(): void;
  listenerCount<K extends keyof Events & string>(event: K): number;
}

type Listener = (payload: unknown) => void;

/** Creates a typed {@link EventEmitter}. */
export function createEventEmitter<Events extends EventMap>(): EventEmitter<Events> {
  const listeners = new Map<string, Set<Listener>>();

  return {
    on(event, listener) {
      let set = listeners.get(event);
      if (set === undefined) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as Listener);
      return () => this.off(event, listener);
    },
    off(event, listener) {
      const set = listeners.get(event);
      if (set === undefined) return;
      set.delete(listener as Listener);
      if (set.size === 0) listeners.delete(event);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (set === undefined) return;
      for (const listener of [...set]) {
        try {
          (listener as Listener)(payload);
        } catch {
          // Listener errors never break the compiler pipeline.
        }
      }
    },
    clear() {
      listeners.clear();
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}
