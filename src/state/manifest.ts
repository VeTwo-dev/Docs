import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { STATE_MANIFEST_FILE } from "./paths.js";
import { atomicWriteFile } from "./atomic.js";
import type { NamespaceRetention, NamespaceStatus } from "./registry.js";

/** Schema version of the `.vetwo/docs/state.json` manifest. Bump on breaking changes. */
export const STATE_SCHEMA_VERSION = 1 as const;

/**
 * Metadata for a single namespace recorded in the state manifest.
 *
 * Unknown fields authored by other tools are preserved verbatim when the
 * manifest is re-written — this type only describes the fields the engine
 * understands.
 */
export interface NamespaceMeta {
  /** Schema version of the namespace content. */
  readonly version: number;
  /** Whether the namespace is currently in use. */
  readonly active: boolean;
  /** Retention class of the namespace. */
  readonly retention?: NamespaceRetention;
  /** Lifecycle status of the namespace. */
  readonly status?: NamespaceStatus;
  /** ISO timestamp of first provisioning. */
  readonly firstSeenAt?: string;
  /** ISO timestamp of last use. */
  readonly lastUsedAt?: string;
}

/**
 * The root state manifest tracked at `.vetwo/docs/state.json`.
 *
 * Records enough information to reason about the state directory safely:
 * schema/engine versions, project identity, when state was initialized, the
 * migration level applied, and the set of namespaces actually in use. The
 * namespace map is a lightweight directory of active namespaces; it is
 * merged (never delete→recreate) on every write so unknown data survives.
 */
export interface StateManifest {
  /** Schema version of this manifest. */
  readonly schemaVersion: number;
  /** `@vetwo/docs` version that produced the state. */
  readonly engineVersion: string;
  /** Project name the state belongs to. */
  readonly project: string;
  /** Project root the state lives under. */
  readonly root: string;
  /** ISO timestamp of state initialization. */
  readonly initializedAt: string;
  /** ISO timestamp of the last build that touched state. */
  readonly lastBuild?: string;
  /** Output directory captured at initialization, when known. */
  readonly output?: string;
  /** Highest legacy-state migration level applied. */
  readonly migrationVersion: number;
  /** Active (and previously active) namespaces, keyed by id. */
  readonly namespaces: Readonly<Record<string, NamespaceMeta>>;
}

/** Minimal valid shape used when validating parsed manifests. */
export interface StateManifestLike {
  readonly schemaVersion?: unknown;
  readonly project?: unknown;
  readonly root?: unknown;
  readonly initializedAt?: unknown;
}

/** The raw parsed manifest plus the typed view (for lossless re-writes). */
export interface RawStateManifest {
  /** The typed manifest. */
  readonly manifest: StateManifest;
  /** The full parsed JSON object, including unknown fields. */
  readonly raw: Record<string, unknown>;
}

/** Whether a parsed value looks like a valid state manifest. */
export function isValidStateManifest(raw: unknown): raw is StateManifest {
  if (typeof raw !== "object" || raw === null) return false;
  const candidate = raw as StateManifestLike;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.project === "string" &&
    typeof candidate.root === "string" &&
    typeof candidate.initializedAt === "string"
  );
}

/** Defaults used when building a fresh state manifest. */
export interface StateManifestDefaults {
  readonly engineVersion?: string;
  readonly project?: string;
  readonly root: string;
  readonly output?: string;
}

/** Normalise a raw namespace entry into the typed shape (or `undefined`). */
export function toNamespaceMeta(value: unknown): NamespaceMeta | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const entry = value as Record<string, unknown>;
  if (typeof entry["version"] !== "number") return undefined;
  return {
    version: entry["version"],
    active: typeof entry["active"] === "boolean" ? entry["active"] : true,
    retention:
      typeof entry["retention"] === "string"
        ? (entry["retention"] as NamespaceRetention)
        : "persistent",
    status: typeof entry["status"] === "string" ? (entry["status"] as NamespaceStatus) : "active",
    firstSeenAt: typeof entry["firstSeenAt"] === "string" ? entry["firstSeenAt"] : undefined,
    lastUsedAt: typeof entry["lastUsedAt"] === "string" ? entry["lastUsedAt"] : undefined,
  };
}

/** Create a fresh state manifest. */
export function createStateManifest(defaults: StateManifestDefaults): StateManifest {
  const now = new Date().toISOString();
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    engineVersion: defaults.engineVersion ?? "0.0.0",
    project: defaults.project ?? "",
    root: defaults.root,
    initializedAt: now,
    output: defaults.output,
    migrationVersion: 0,
    namespaces: {},
  };
}

/**
 * Read and parse the state manifest, retaining the raw object so unknown
 * fields can be preserved on later writes. Returns `undefined` when the file
 * is absent or invalid.
 */
export function readStateManifestRaw(
  fs: SafeFileSystem,
  rootDir: string,
): RawStateManifest | undefined {
  const path = resolveStateManifestPath(fs, rootDir);
  if (!fs.isFile(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFile(path));
  } catch {
    return undefined;
  }
  if (!isValidStateManifest(parsed)) return undefined;
  const raw = parsed as unknown as Record<string, unknown>;
  const rawNamespaces =
    typeof raw["namespaces"] === "object" &&
    raw["namespaces"] !== null &&
    !Array.isArray(raw["namespaces"])
      ? (raw["namespaces"] as Record<string, unknown>)
      : {};
  const namespaces: Record<string, NamespaceMeta> = {};
  for (const [id, entry] of Object.entries(rawNamespaces)) {
    const meta = toNamespaceMeta(entry);
    if (meta !== undefined) namespaces[id] = meta;
  }
  const manifest: StateManifest = {
    schemaVersion: raw["schemaVersion"] as number,
    engineVersion: typeof raw["engineVersion"] === "string" ? raw["engineVersion"] : "0.0.0",
    project: raw["project"] as string,
    root: raw["root"] as string,
    initializedAt: raw["initializedAt"] as string,
    lastBuild: typeof raw["lastBuild"] === "string" ? raw["lastBuild"] : undefined,
    output: typeof raw["output"] === "string" ? raw["output"] : undefined,
    migrationVersion: typeof raw["migrationVersion"] === "number" ? raw["migrationVersion"] : 0,
    namespaces,
  };
  return { manifest, raw };
}

/** Read and parse the state manifest; returns `undefined` when absent/invalid. */
export function readStateManifest(fs: SafeFileSystem, rootDir: string): StateManifest | undefined {
  return readStateManifestRaw(fs, rootDir)?.manifest;
}

/**
 * Serialise and write the state manifest, preserving unknown fields.
 *
 * The previous raw JSON (including fields this engine does not understand,
 * at the top level and inside every namespace entry) is merged with the typed
 * manifest before writing. The write itself is atomic.
 */
export function writeStateManifestMerged(
  fs: SafeFileSystem,
  rootDir: string,
  raw: Record<string, unknown> | undefined,
  manifest: StateManifest,
): void {
  const existingNamespaces =
    raw !== undefined && typeof raw["namespaces"] === "object" && raw["namespaces"] !== null
      ? (raw["namespaces"] as Record<string, unknown>)
      : {};
  const merged: Record<string, unknown> = {
    ...raw,
    schemaVersion: manifest.schemaVersion,
    engineVersion: manifest.engineVersion,
    project: manifest.project,
    root: manifest.root,
    initializedAt: manifest.initializedAt,
    lastBuild: manifest.lastBuild,
    output: manifest.output,
    migrationVersion: manifest.migrationVersion,
    namespaces: {
      ...existingNamespaces,
      ...manifest.namespaces,
    },
  };
  atomicWriteFile(
    fs,
    resolveStateManifestPath(fs, rootDir),
    JSON.stringify(merged, null, 2) + "\n",
  );
}

/** Serialise and write the state manifest (loses unknown fields; prefer merged). */
export function writeStateManifest(
  fs: SafeFileSystem,
  rootDir: string,
  manifest: StateManifest,
): void {
  writeStateManifestMerged(fs, rootDir, undefined, manifest);
}

/** Absolute path to `.vetwo/docs/state.json`. */
export function resolveStateManifestPath(fs: SafeFileSystem, rootDir: string): string {
  return fs.join(rootDir, ".vetwo", "docs", STATE_MANIFEST_FILE);
}
