import type { FSWatcher } from "chokidar";
import { watch as chokidarWatch } from "chokidar";
import type { RawWatchEvent, RawWatchEventType, ScannerWatchListener } from "../types/events.js";
import { toPosixPath } from "../utils/path.js";
import { classifyWatchEvent, type WatchClassifyContext } from "./events.js";

/** A source of raw filesystem watch events. */
export interface WatchSource {
  /** Registers a listener. Returns an unsubscribe function. */
  on(listener: (event: RawWatchEvent) => void): () => void;
  /** Stops the source. */
  close(): void;
}

/** Options for {@link ChokidarWatchSource}. */
export interface ChokidarWatchSourceOptions {
  readonly rootDir: string;
  /** Ignore predicate receiving absolute paths. */
  readonly ignored?: (path: string) => boolean;
}

/**
 * A watch source backed by chokidar. Emits raw events for files and
 * directories below the root.
 */
export class ChokidarWatchSource implements WatchSource {
  private readonly watcher: FSWatcher;
  private readonly listeners = new Set<(event: RawWatchEvent) => void>();

  constructor(options: ChokidarWatchSourceOptions) {
    const root = options.rootDir;
    const emit = (type: RawWatchEventType) => (path: string) => {
      for (const listener of this.listeners) listener({ type, path: toPosixPath(path) });
    };
    this.watcher = chokidarWatch(root, {
      ignoreInitial: true,
      ignored: options.ignored,
      persistent: true,
      depth: undefined,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
    });
    this.watcher.on("add", emit("add"));
    this.watcher.on("change", emit("change"));
    this.watcher.on("unlink", emit("unlink"));
    this.watcher.on("addDir", emit("addDir"));
    this.watcher.on("unlinkDir", emit("unlinkDir"));
  }

  on(listener: (event: RawWatchEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
    void this.watcher.close();
  }
}

/** A watch source driven manually — used for tests and plugin bridges. */
export class ManualWatchSource implements WatchSource {
  private readonly listeners = new Set<(event: RawWatchEvent) => void>();
  private closed = false;

  on(listener: (event: RawWatchEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Emits a raw event to all listeners. */
  emit(event: RawWatchEvent): void {
    if (this.closed) return;
    for (const listener of this.listeners) listener(event);
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }
}

/** Options for constructing a {@link ScannerWatcher}. */
export interface ScannerWatcherOptions extends WatchClassifyContext {
  readonly source: WatchSource;
}

/**
 * Normalises raw watch events into high-level {@link ScannerWatchEvent}s and
 * fans them out to listeners.
 */
export class ScannerWatcher {
  private readonly source: WatchSource;
  private readonly context: WatchClassifyContext;
  private readonly listeners = new Set<ScannerWatchListener>();
  private readonly unsubscribe: () => void;
  private closed = false;

  constructor(options: ScannerWatcherOptions) {
    this.source = options.source;
    this.context = {
      rootDir: options.rootDir,
      packages: options.packages,
      workspaces: options.workspaces,
    };
    this.unsubscribe = this.source.on((raw) => this.handle(raw));
  }

  private handle(raw: RawWatchEvent): void {
    if (this.closed) return;
    const event = classifyWatchEvent(raw, this.context);
    for (const listener of this.listeners) listener(event);
  }

  /** Registers a listener. Returns an unsubscribe function. */
  on(listener: ScannerWatchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Whether the watcher is still active. */
  get isClosed(): boolean {
    return this.closed;
  }

  /** Stops the watcher and releases the underlying source. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe();
    this.source.close();
    this.listeners.clear();
  }

  /** Serialises the watcher to a JSON-serialisable description (debugging). */
  toJSON(): Readonly<Record<string, unknown>> {
    return {
      rootDir: this.context.rootDir,
      closed: this.closed,
      listeners: this.listeners.size,
    };
  }
}
