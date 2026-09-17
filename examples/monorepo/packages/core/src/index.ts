/**
 * Creates an event emitter instance.
 *
 * @returns An object with on, emit, and off methods.
 */
export function createEmitter() {
  const listeners = new Map<string, Set<Function>>();

  return {
    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
    },
  };
}
