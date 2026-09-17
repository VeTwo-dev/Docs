import type { CompilationResult } from "../results/index.js";

/**
 * Compiler watch events.
 *
 * Consumers subscribe through the compiler manager; the manager is the only
 * emitter. Every event payload is immutable.
 */
export interface CompilerEvents {
  "compilation-started": {
    readonly requestId: string;
    readonly compilerId: string;
    readonly languageId: string;
    readonly files: readonly string[];
    readonly timestamp: number;
  };
  "compilation-finished": {
    readonly requestId: string;
    readonly compilerId: string;
    readonly languageId: string;
    readonly result: CompilationResult;
    readonly timestamp: number;
  };
  "compilation-failed": {
    readonly requestId: string;
    readonly compilerId: string;
    readonly languageId: string;
    readonly result: CompilationResult;
    readonly timestamp: number;
  };
  "file-recompiled": {
    readonly requestId: string;
    readonly compilerId: string;
    readonly languageId: string;
    readonly file: string;
    readonly status: "ok" | "failed" | "skipped";
    readonly timestamp: number;
  };
  "project-updated": {
    readonly requestId: string;
    readonly compilerId: string;
    readonly languageId: string;
    readonly changed: readonly string[];
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly renamed: Readonly<Record<string, string>>;
    readonly timestamp: number;
  };
}

/** A compiler event name. */
export type CompilerEvent = keyof CompilerEvents;

/** The payload of a compiler event. */
export type CompilerEventPayload<E extends CompilerEvent> = CompilerEvents[E];

/** A listener subscribed to a compiler event. */
export type CompilerEventListener<E extends CompilerEvent> = (payload: CompilerEvents[E]) => void;

/** A handle returned by {@link CompilerManager.on}, used to unsubscribe. */
export interface CompilerSubscription {
  /** Unsubscribes the listener. */
  readonly off: () => void;
}
