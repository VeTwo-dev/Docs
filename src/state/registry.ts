import type { StateOwnershipCategory } from "./namespaces.js";

/**
 * Retention class of a state namespace. Drives what `docs clean` targets and
 * how aggressively the engine may rebuild or discard a namespace.
 *
 * - `cache`: rebuildable build artefacts (safe to wipe with `--cache`).
 * - `temporary`: scratch state (safe to wipe with `--temporary`).
 * - `persistent`: derived/internal state that can be regenerated but is kept
 *   between runs (`--state`).
 * - `generated`: engine-generated internal artefacts, regenerable.
 */
export type NamespaceRetention = "persistent" | "cache" | "temporary" | "generated";

/** Status of a namespace recorded in the state manifest. */
export type NamespaceStatus = "active" | "orphaned" | "unknown";

/**
 * A registered state namespace.
 *
 * Subsystems and plugins declare the state they may write so the central
 * manager can provision it lazily (only when actually used) and clean it
 * safely (by retention class) without ever guessing from filenames alone.
 */
export interface NamespaceDefinition {
  /** Stable identifier, e.g. `scanner`, `plugin:acme`, `ai:openwiki`. */
  readonly id: string;
  /** Schema version of the namespace content. */
  readonly version: number;
  /** Retention class used by `docs clean`. */
  readonly retention: NamespaceRetention;
  /** Ownership category used for reporting and cleaning. */
  readonly category: StateOwnershipCategory;
  /** Short human-readable label for reports. */
  readonly label?: string;
}

/**
 * The directory segments a namespace id maps to under the state root.
 *
 * Flat subsystems live at `.vetwo/docs/<id>/`. Plugins are isolated under
 * `.vetwo/docs/plugins/<plugin-id>/` and AI providers under
 * `.vetwo/docs/ai/providers/<provider>/`. Only the `plugin:` and `ai:`
 * prefixes are hierarchical today; everything else maps 1:1.
 */
export function namespaceSegments(id: string): readonly string[] {
  if (id.startsWith("plugin:")) {
    const name = id.slice("plugin:".length);
    return ["plugins", name];
  }
  if (id.startsWith("ai:")) {
    const name = id.slice("ai:".length);
    return ["ai", "providers", name];
  }
  return [id];
}

/**
 * A registry of state namespaces.
 *
 * Registries are open: any subsystem can {@link register} its own namespace
 * at any time without touching the central manager. The default registry is
 * pre-populated with the built-in engine namespaces but never treats that
 * list as exhaustive — unknown ids can always be registered later.
 */
export interface StateNamespaceRegistry {
  /** Register (or re-register) a namespace definition. */
  register(def: NamespaceDefinition): void;
  /** Whether an id has a registered definition. */
  isRegistered(id: string): boolean;
  /** The registered definition for an id, or `undefined`. */
  get(id: string): NamespaceDefinition | undefined;
  /** All registered definitions. */
  list(): readonly NamespaceDefinition[];
  /** The directory segments an id maps to under the state root. */
  segments(id: string): readonly string[];
}

/** Create an (optionally pre-populated) namespace registry. */
export function createStateNamespaceRegistry(
  initial?: readonly NamespaceDefinition[],
): StateNamespaceRegistry {
  const definitions = new Map<string, NamespaceDefinition>();
  for (const def of initial ?? []) definitions.set(def.id, def);
  return {
    register(def) {
      definitions.set(def.id, def);
    },
    isRegistered(id) {
      return definitions.has(id);
    },
    get(id) {
      return definitions.get(id);
    },
    list() {
      return [...definitions.values()];
    },
    segments(id) {
      return namespaceSegments(id);
    },
  };
}

/**
 * Built-in engine namespaces. Each is optional: a directory is only ever
 * created when the corresponding feature actually writes state.
 */
export const DEFAULT_STATE_NAMESPACES: readonly NamespaceDefinition[] = [
  { id: "scanner", version: 1, retention: "cache", category: "cache", label: "Scanner cache" },
  { id: "compiler", version: 1, retention: "cache", category: "cache", label: "Compiler cache" },
  { id: "generator", version: 1, retention: "cache", category: "cache", label: "Generator cache" },
  { id: "symbols", version: 1, retention: "persistent", category: "index", label: "Symbols index" },
  {
    id: "references",
    version: 1,
    retention: "persistent",
    category: "graph",
    label: "Reference graph",
  },
  { id: "types", version: 1, retention: "persistent", category: "index", label: "Types index" },
  {
    id: "semantic",
    version: 1,
    retention: "persistent",
    category: "index",
    label: "Semantic index",
  },
  {
    id: "knowledge",
    version: 1,
    retention: "persistent",
    category: "graph",
    label: "Knowledge graph",
  },
  {
    id: "framework",
    version: 1,
    retention: "persistent",
    category: "analysis",
    label: "Framework analysis",
  },
  {
    id: "documentation",
    version: 1,
    retention: "persistent",
    category: "index",
    label: "Documentation index",
  },
  {
    id: "examples",
    version: 1,
    retention: "persistent",
    category: "index",
    label: "Examples index",
  },
  {
    id: "relationships",
    version: 1,
    retention: "persistent",
    category: "graph",
    label: "Relationship graph",
  },
  {
    id: "ai",
    version: 1,
    retention: "persistent",
    category: "generated-internal",
    label: "AI state",
  },
  { id: "ai:cache", version: 1, retention: "cache", category: "cache", label: "AI cache" },
  { id: "ai:runs", version: 1, retention: "temporary", category: "temporary", label: "AI runs" },
  { id: "ai:plans", version: 1, retention: "persistent", category: "index", label: "AI plans" },
  {
    id: "plans",
    version: 1,
    retention: "persistent",
    category: "index",
    label: "Documentation plans",
  },
  {
    id: "snapshots",
    version: 1,
    retention: "persistent",
    category: "generated-internal",
    label: "Documentation snapshots",
  },
  {
    id: "conflicts",
    version: 1,
    retention: "temporary",
    category: "diagnostic",
    label: "Content conflicts",
  },
  {
    id: "translations",
    version: 1,
    retention: "persistent",
    category: "index",
    label: "Translation state",
  },
  {
    id: "compiler-ir",
    version: 1,
    retention: "persistent",
    category: "generated-internal",
    label: "Documentation IR",
  },
  { id: "search", version: 1, retention: "persistent", category: "index", label: "Search index" },
  {
    id: "renderer",
    version: 1,
    retention: "persistent",
    category: "generated-internal",
    label: "Renderer state",
  },
  { id: "graph", version: 1, retention: "persistent", category: "graph", label: "Graph state" },
  { id: "index", version: 1, retention: "persistent", category: "index", label: "Index state" },
  { id: "analysis", version: 1, retention: "persistent", category: "analysis", label: "Analysis" },
  {
    id: "generated",
    version: 1,
    retention: "generated",
    category: "generated-internal",
    label: "Generated artefacts",
  },
  {
    id: "manifests",
    version: 1,
    retention: "persistent",
    category: "manifest",
    label: "Workspace manifests",
  },
  {
    id: "diagnostics",
    version: 1,
    retention: "temporary",
    category: "diagnostic",
    label: "Diagnostics",
  },
  { id: "reports", version: 1, retention: "temporary", category: "report", label: "Reports" },
  {
    id: "temporary",
    version: 1,
    retention: "temporary",
    category: "temporary",
    label: "Temporary files",
  },
];

/** The shared default registry. Subsystems register extra namespaces into it. */
export const DEFAULT_REGISTRY: StateNamespaceRegistry =
  createStateNamespaceRegistry(DEFAULT_STATE_NAMESPACES);

/**
 * Register a namespace with the (default) registry so a feature can later
 * provision it lazily. Future subsystems can register `semantic`,
 * `knowledge`, `framework`, `plugin:<id>`, `ai:<provider>`, etc. without
 * modifying the central state manager.
 */
export function registerStateNamespace(
  def: NamespaceDefinition,
  registry: StateNamespaceRegistry = DEFAULT_REGISTRY,
): void {
  registry.register(def);
}
