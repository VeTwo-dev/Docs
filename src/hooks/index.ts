import type { LifecycleHookName } from "../types/public.js";
import type { HookHandler, HookContext } from "../types/internal.js";

export type { HookContext };

/** Registry that manages lifecycle hook registration and execution. */
export interface HookRegistry {
  /** Registers a handler for a given lifecycle hook. */
  register(hook: LifecycleHookName, handler: HookHandler): void;
  /** Executes all handlers registered for a given lifecycle hook in sequence. */
  execute(hook: LifecycleHookName, context: HookContext): Promise<void>;
  /** Returns all handlers registered for a given lifecycle hook. */
  getAll(hook: LifecycleHookName): readonly HookHandler[];
  /** Removes all registered handlers. */
  clear(): void;
}

/**
 * Creates a new {@link HookRegistry} for managing lifecycle hooks.
 *
 * @returns A new HookRegistry instance.
 *
 * @example
 * ```ts
 * const hooks = createHookRegistry();
 * hooks.register("init", async ({ ctx }) => { ... });
 * await hooks.execute("init", hookContext);
 * ```
 */
export function createHookRegistry(): HookRegistry {
  const hooks = new Map<LifecycleHookName, HookHandler[]>();

  return {
    register(hook: LifecycleHookName, handler: HookHandler): void {
      const existing = hooks.get(hook) ?? [];
      existing.push(handler);
      hooks.set(hook, existing);
    },

    async execute(hook: LifecycleHookName, context: HookContext): Promise<void> {
      const handlers = hooks.get(hook) ?? [];
      for (const handler of handlers) {
        await handler(context);
      }
    },

    getAll(hook: LifecycleHookName): readonly HookHandler[] {
      return hooks.get(hook) ?? [];
    },

    clear(): void {
      hooks.clear();
    },
  };
}
