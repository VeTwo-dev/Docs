import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";
import { NodeSafeFileSystem } from "../init/filesystem/node.js";
import { getDocsStateRoot } from "./paths.js";
import { atomicWriteFile } from "./atomic.js";
import type { NamespaceDefinition } from "./registry.js";
import { DEFAULT_REGISTRY, type StateNamespaceRegistry } from "./registry.js";
import {
  createStateManifest,
  readStateManifest,
  readStateManifestRaw,
  toNamespaceMeta,
  writeStateManifestMerged,
  type NamespaceMeta,
  type StateManifest,
} from "./manifest.js";
import { applyMigration, needsMigration, type MigrationResult } from "./migrate.js";

/** Options for creating a {@link DocsStateManager}. */
export interface DocsStateManagerOptions {
  /** The project root. Falls back to `process.cwd()`. */
  readonly rootDir?: string;
  /** Filesystem seam; defaults to the real `node:fs` implementation. */
  readonly fs?: SafeFileSystem;
  /** Engine version recorded in `state.json`. */
  readonly engineVersion?: string;
  /** Project name recorded in `state.json`. */
  readonly project?: string;
  /** Namespace registry; defaults to the shared engine registry. */
  readonly registry?: StateNamespaceRegistry;
}

/**
 * The central docs state manager.
 *
 * Owns every byte `@vetwo/docs` writes into a project under the canonical
 * `.vetwo/docs/` root. Namespaces are provisioned lazily and dynamically: a
 * directory is created only when a subsystem calls {@link ensureNamespace}
 * (or writes into a namespace), never preemptively. The namespace manifest is
 * always merged, unknown data is preserved, and important files are written
 * atomically.
 */
export interface DocsStateManager {
  /** The project root. */
  readonly rootDir: string;
  /** The canonical state root (`.vetwo/docs/`). */
  readonly stateRoot: string;
  /** The filesystem seam in use. */
  readonly fs: SafeFileSystem;
  /** The namespace registry in use. */
  readonly registry: StateNamespaceRegistry;
  /** The canonical state root. */
  getRoot(): string;
  /** Register a namespace definition so it can be provisioned lazily. */
  register(def: NamespaceDefinition): void;
  /** Resolve a raw path inside the state root (does not create anything). */
  resolve(...parts: readonly string[]): string;
  /**
   * Resolve a path inside a namespace. The id maps to its canonical
   * directory (`scanner` → `cache/scanner` historically, now `scanner/`;
   * `plugin:acme` → `plugins/acme/`). Does not create anything.
   */
  resolveNamespace(namespace: string, ...parts: readonly string[]): string;
  /**
   * Lazily provision a namespace: register it (with safe defaults when it is
   * new), create its directory, and record it as active in `state.json`.
   * Returns the namespace directory.
   */
  ensureNamespace(namespace: string): string;
  /** Whether a path inside the state root exists. */
  exists(...parts: readonly string[]): boolean;
  /** Whether a path inside the state root is a file. */
  isFile(...parts: readonly string[]): boolean;
  /** Read a UTF-8 file inside the state root; `undefined` when missing. */
  read(...parts: readonly string[]): string | undefined;
  /** Read and parse a JSON file; `undefined` when missing or invalid. */
  readJson<T>(...parts: readonly string[]): T | undefined;
  /** Atomically write a UTF-8 file inside the state root; returns the path. */
  write(content: string, ...parts: readonly string[]): string;
  /** Atomically write a JSON value inside the state root; returns the path. */
  writeJson(value: unknown, ...parts: readonly string[]): string;
  /** Remove a file/directory inside the state root; returns whether something was removed. */
  remove(...parts: readonly string[]): boolean;
  /**
   * Remove a whole directory subtree inside the state root.
   * Returns the list of removed paths (empty when nothing existed).
   */
  clear(...parts: readonly string[]): readonly string[];
  /**
   * Initialize the state root. Idempotent and non-destructive — existing
   * state (including a user-authored or unknown `state.json`) is preserved
   * and merged, never overwritten blindly. Returns the state manifest.
   */
  initialize(): StateManifest;
  /** The current state manifest (a fresh default when none exists yet). */
  getState(): StateManifest;
  /** Metadata recorded for a namespace, or `undefined`. */
  getNamespaceMeta(namespace: string): NamespaceMeta | undefined;
  /** Record that a namespace is in use (persisted in `state.json`). */
  touch(namespace: string): void;
  /** Whether a legacy-state migration is pending. */
  needsMigration(): boolean;
  /** Apply any pending legacy-state migration. Safe to re-run. */
  migrate(): MigrationResult;
}

/** Default definition applied when a namespace id is used before registration. */
function defaultDefinition(id: string): NamespaceDefinition {
  return { id, version: 1, retention: "persistent", category: "metadata" };
}

class DocsStateManagerImpl implements DocsStateManager {
  readonly rootDir: string;
  readonly fs: SafeFileSystem;
  readonly stateRoot: string;
  readonly registry: StateNamespaceRegistry;

  private readonly engineVersion: string;
  private readonly project: string;
  private readonly stateManifestPath: string;

  constructor(options: DocsStateManagerOptions) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.fs = options.fs ?? new NodeSafeFileSystem();
    this.stateRoot = getDocsStateRoot(this.rootDir);
    this.stateManifestPath = posixJoin(this.stateRoot, "state.json");
    this.engineVersion = options.engineVersion ?? "0.0.0";
    this.project = options.project ?? "";
    this.registry = options.registry ?? DEFAULT_REGISTRY;
  }

  getRoot(): string {
    return this.stateRoot;
  }

  register(def: NamespaceDefinition): void {
    this.registry.register(def);
  }

  resolve(...parts: readonly string[]): string {
    return posixJoin(this.stateRoot, ...parts);
  }

  resolveNamespace(namespace: string, ...parts: readonly string[]): string {
    return posixJoin(this.stateRoot, ...this.registry.segments(namespace), ...parts);
  }

  ensureNamespace(namespace: string): string {
    if (!this.registry.isRegistered(namespace)) {
      this.register(defaultDefinition(namespace));
    }
    const dir = this.resolveNamespace(namespace);
    this.fs.mkdir(dir);
    this.touch(namespace);
    return dir;
  }

  exists(...parts: readonly string[]): boolean {
    return this.fs.exists(this.resolveParts(parts));
  }

  isFile(...parts: readonly string[]): boolean {
    return this.fs.isFile(this.resolveParts(parts));
  }

  read(...parts: readonly string[]): string | undefined {
    const path = this.resolveParts(parts);
    if (!this.fs.isFile(path)) return undefined;
    try {
      return this.fs.readFile(path);
    } catch {
      return undefined;
    }
  }

  readJson<T>(...parts: readonly string[]): T | undefined {
    const content = this.read(...parts);
    if (content === undefined) return undefined;
    try {
      return JSON.parse(content) as T;
    } catch {
      return undefined;
    }
  }

  write(content: string, ...parts: readonly string[]): string {
    const path = this.resolveParts(parts);
    atomicWriteFile(this.fs, path, content);
    this.recordNamespaceFor(parts);
    return path;
  }

  writeJson(value: unknown, ...parts: readonly string[]): string {
    return this.write(JSON.stringify(value, null, 2) + "\n", ...parts);
  }

  remove(...parts: readonly string[]): boolean {
    return this.fs.remove(this.resolveParts(parts));
  }

  clear(...parts: readonly string[]): readonly string[] {
    const path = this.resolveParts(parts);
    if (!this.fs.exists(path)) return [];
    const removed: string[] = [];
    for (const file of this.fs.listFiles(path)) {
      const full = posixJoin(path, file);
      this.fs.remove(full);
      removed.push(full);
    }
    this.fs.remove(path);
    removed.push(path);
    return removed;
  }

  initialize(): StateManifest {
    this.fs.mkdir(this.stateRoot);
    const existing = readStateManifestRaw(this.fs, this.rootDir);
    if (existing !== undefined) return existing.manifest;

    // An unreadable/invalid manifest is unknown user data: preserve it by
    // backing it up, then start a fresh manifest so the system can function.
    if (this.fs.isFile(this.stateManifestPath)) {
      this.backupCorruptManifest();
    }

    const manifest = createStateManifest({
      engineVersion: this.engineVersion,
      project: this.project,
      root: this.rootDir,
    });
    writeStateManifestMerged(this.fs, this.rootDir, undefined, manifest);
    return manifest;
  }

  getState(): StateManifest {
    return (
      readStateManifest(this.fs, this.rootDir) ??
      createStateManifest({
        root: this.rootDir,
        engineVersion: this.engineVersion,
        project: this.project,
      })
    );
  }

  getNamespaceMeta(namespace: string): NamespaceMeta | undefined {
    return this.getState().namespaces[namespace];
  }

  touch(namespace: string): void {
    if (!this.registry.isRegistered(namespace)) {
      this.register(defaultDefinition(namespace));
    }
    const def = this.registry.get(namespace) as NamespaceDefinition;
    const now = new Date().toISOString();
    const current = readStateManifestRaw(this.fs, this.rootDir);
    const base =
      current?.manifest ??
      createStateManifest({
        root: this.rootDir,
        engineVersion: this.engineVersion,
        project: this.project,
      });
    const previous = base.namespaces[namespace];
    const meta = toNamespaceMeta({
      ...(previous ?? {}),
      version: def.version,
      active: true,
      retention: def.retention,
      status: "active",
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastUsedAt: now,
    });
    if (meta === undefined) return;
    const updated: StateManifest = {
      ...base,
      namespaces: { ...base.namespaces, [namespace]: meta },
    };
    writeStateManifestMerged(this.fs, this.rootDir, current?.raw, updated);
  }

  needsMigration(): boolean {
    return needsMigration(this.fs, this.rootDir);
  }

  migrate(): MigrationResult {
    const result = applyMigration(this.fs, this.rootDir);
    const current = readStateManifestRaw(this.fs, this.rootDir);
    const manifest =
      current?.manifest ??
      createStateManifest({
        root: this.rootDir,
        engineVersion: this.engineVersion,
        project: this.project,
      });
    if (result.applied && manifest.migrationVersion < result.migrationVersion) {
      writeStateManifestMerged(this.fs, this.rootDir, current?.raw, {
        ...manifest,
        migrationVersion: result.migrationVersion,
      });
    }
    return result;
  }

  private resolveParts(parts: readonly string[]): string {
    const [first, ...rest] = parts;
    if (first !== undefined && this.registry.isRegistered(first)) {
      return this.resolveNamespace(first, ...rest);
    }
    return this.resolve(...parts);
  }

  private recordNamespaceFor(parts: readonly string[]): void {
    const first = parts[0];
    if (first === undefined) return;
    if (this.registry.isRegistered(first)) {
      this.touch(first);
    }
  }

  private backupCorruptManifest(): void {
    const stamp = Date.now().toString(36);
    const backup = posixJoin(this.stateRoot, `state.json.corrupt-${stamp}`);
    this.fs.rename(this.stateManifestPath, backup);
  }
}

/**
 * Create a {@link DocsStateManager} for a project root.
 *
 * @param options - Root directory, optional filesystem seam, engine/project identity.
 * @returns A configured state manager.
 *
 * @example
 * ```ts
 * const state = createDocsStateManager({ rootDir: "/project" });
 * state.initialize();
 * state.ensureNamespace("scanner");   // creates .vetwo/docs/scanner/ lazily
 * state.ensureNamespace("compiler");  // creates .vetwo/docs/compiler/ lazily
 * ```
 */
export function createDocsStateManager(options: DocsStateManagerOptions = {}): DocsStateManager {
  return new DocsStateManagerImpl(options);
}

/**
 * Lazily provision a state namespace for a project root.
 *
 * Convenience for subsystems that write state through their own filesystem
 * primitives: it routes the "request namespace" through the central manager
 * so the directory is created and registered only when the feature actually
 * needs it. Returns the absolute namespace directory.
 */
export function ensureStateNamespace(
  rootDir: string,
  namespace: string,
  options: Pick<DocsStateManagerOptions, "fs" | "project" | "engineVersion"> = {},
): string {
  return createDocsStateManager({
    rootDir,
    fs: options.fs,
    project: options.project,
    engineVersion: options.engineVersion,
  }).ensureNamespace(namespace);
}
