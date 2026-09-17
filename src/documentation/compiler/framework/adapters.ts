/**
 * Framework Documentation Adapters.
 *
 * Extensible provider hooks that let frameworks enrich the documentation
 * architecture (recommended sections, important concepts, common workflows,
 * conventions) without modifying the compiler core.
 */

import type { CompilerProjectInput, PageKind } from "../types.js";

/** Capabilities every framework documentation adapter may provide. */
export interface FrameworkDocumentationAdapter {
  /** Stable adapter id (e.g. `"nextjs"`, `"react-library"`). */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Return true when this adapter applies to the project input. */
  matches(input: CompilerProjectInput): boolean;
  /** Extra sections this framework recommends (ids must be namespaced). */
  getRecommendedSections?(input: CompilerProjectInput): readonly {
    readonly id: string;
    readonly title: string;
    readonly kinds?: readonly PageKind[];
    readonly rationale: string;
  }[];
  /** Concepts the framework considers first-class and worth documenting. */
  getImportantConcepts?(input: CompilerProjectInput): readonly { name: string; kind: string }[];
  /** Typical workflows to seed guides from. */
  getCommonWorkflows?(): readonly { name: string; steps: readonly string[] }[];
  /** Artifacts users expect to find documented for this framework. */
  getExpectedArtifacts?(): readonly string[];
  /** Documentation conventions (naming, structure hints). */
  getDocumentationConventions?(): readonly string[];
}

/** ─── Built-in Adapters ─────────────────────────────────────────────── */

const nextjsAdapter: FrameworkDocumentationAdapter = {
  id: "nextjs",
  label: "Next.js",
  matches: (input) =>
    (input.signals.dependencies ?? []).includes("next") || input.signals.framework === "next",
  getRecommendedSections: () => [
    {
      id: "routing",
      title: "Routing",
      kinds: ["concept", "guide"],
      rationale: "Routing is central to Next.js projects.",
    },
    {
      id: "data-fetching",
      title: "Data Fetching",
      kinds: ["guide"],
      rationale: "Server/client data patterns.",
    },
    {
      id: "deployment",
      title: "Deployment",
      kinds: ["guide"],
      rationale: "Hosting expectations for Next.js apps.",
    },
  ],
  getImportantConcepts: () => [
    { name: "app-router", kind: "concept" },
    { name: "server-components", kind: "concept" },
    { name: "client-boundaries", kind: "concept" },
    { name: "middleware", kind: "concept" },
  ],
  getCommonWorkflows: () => [
    { name: "Create a route", steps: ["Create directory", "Add page file", "Add layout"] },
  ],
  getExpectedArtifacts: () => ["app/", "next.config.*"],
  getDocumentationConventions: () => ["Document server vs client components explicitly."],
};

const reactLibraryAdapter: FrameworkDocumentationAdapter = {
  id: "react-library",
  label: "React Library",
  matches: (input) =>
    (input.signals.peerDependencies ?? []).includes("react") ||
    ((input.signals.dependencies ?? []).includes("react") &&
      /^use[A-Z]/.test((input.apis ?? []).map((a) => a.name).join(" ") || "\u0000")),
  getRecommendedSections: () => [
    {
      id: "components",
      title: "Components",
      kinds: ["api", "reference"],
      rationale: "Component catalog.",
    },
    {
      id: "hooks",
      title: "Hooks",
      kinds: ["api", "reference"],
      rationale: "Hook reference with rules of hooks.",
    },
    {
      id: "patterns",
      title: "Patterns",
      kinds: ["concept", "guide"],
      rationale: "Composition patterns.",
    },
  ],
  getImportantConcepts: () => [
    { name: "composition", kind: "concept" },
    { name: "providers", kind: "concept" },
  ],
  getCommonWorkflows: () => [
    { name: "Install and wrap providers", steps: ["Install package", "Wrap app in provider"] },
  ],
  getExpectedArtifacts: () => ["component examples", "hook signatures"],
  getDocumentationConventions: () => ["Every hook documents its dependency array semantics."],
};

const nodeCliAdapter: FrameworkDocumentationAdapter = {
  id: "node-cli",
  label: "Node CLI",
  matches: (input) =>
    input.signals.hasBin === true ||
    input.signals.hasCli === true ||
    (input.signals.commands?.length ?? 0) > 0,
  getRecommendedSections: () => [
    {
      id: "environment",
      title: "Environment",
      kinds: ["configuration"],
      rationale: "CLI tools interact with env vars.",
    },
    {
      id: "exit-codes",
      title: "Exit Codes",
      kinds: ["reference"],
      rationale: "Scriptable CLIs document exit codes.",
    },
  ],
  getImportantConcepts: () => [{ name: "flags-and-options", kind: "concept" }],
  getCommonWorkflows: () => [],
  getExpectedArtifacts: () => ["--help output", "exit code table"],
  getDocumentationConventions: () => ["Every command shows flags in a table."],
};

/** Registry of adapters; extensible at runtime via registerAdapter(). */
const adapters: FrameworkDocumentationAdapter[] = [
  nextjsAdapter,
  reactLibraryAdapter,
  nodeCliAdapter,
];

/** Register an additional framework adapter (last registered wins ties). */
export function registerFrameworkAdapter(adapter: FrameworkDocumentationAdapter): void {
  const idx = adapters.findIndex((a) => a.id === adapter.id);
  if (idx >= 0) adapters[idx] = adapter;
  else adapters.push(adapter);
}

/** All registered adapters (read-only view). */
export function listFrameworkAdapters(): readonly FrameworkDocumentationAdapter[] {
  return [...adapters];
}

/** Find adapters matching a project. */
export function matchAdapters(
  input: CompilerProjectInput,
): readonly FrameworkDocumentationAdapter[] {
  return adapters.filter((adapter) => adapter.matches(input));
}
