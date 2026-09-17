/**
 * Ownership categories for the centralized docs state root.
 *
 * Categories describe *what a namespace holds* and drive reporting, `docs
 * clean` decisions and the migration system. The authoritative set of
 * namespaces lives in the {@link registerStateNamespace} registry — this
 * module only defines the categories used to classify them.
 */

/**
 * Ownership category for a piece of state. Drives what `docs clean` removes
 * and how the migration system decides whether a path belongs to the package.
 */
export type StateOwnershipCategory =
  | "cache"
  | "index"
  | "analysis"
  | "graph"
  | "metadata"
  | "generated-internal"
  | "diagnostic"
  | "report"
  | "temporary"
  | "state"
  | "manifest";

/** Descriptive label for each ownership category. */
export const OWNERSHIP_CATEGORY_LABELS: Readonly<Record<StateOwnershipCategory, string>> = {
  cache: "Rebuildable cache",
  index: "Derived index",
  analysis: "Project analysis",
  graph: "Knowledge graph",
  metadata: "Metadata",
  "generated-internal": "Generated internal artefacts",
  diagnostic: "Diagnostics",
  report: "Reports",
  temporary: "Temporary files",
  state: "State manifest",
  manifest: "Workspace manifests",
};
