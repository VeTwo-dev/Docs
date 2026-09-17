/**
 * Project Knowledge Model (Phase 22).
 *
 * Shared model representing the complete project as a product — identity,
 * purpose, installation, configuration, API, CLI, architecture, dependencies,
 * environment, examples, guides, troubleshooting, development lifecycle, etc.
 *
 * Derived deterministically from scanner → symbols → references → graph →
 * API model + package.json + README + source structure. AI may enrich
 * descriptions but never overrides deterministic facts.
 */

import type { ApiSymbol } from "../api/models.js";
import type { KnowledgeGraph } from "../graph/index.js";

export type ProjectTypeExt =
  | "library"
  | "application"
  | "framework"
  | "cli"
  | "sdk"
  | "plugin"
  | "monorepo"
  | "service"
  | "web-application"
  | "node-application"
  | "react-application"
  | "nextjs-application"
  | "vue-application"
  | "vite-application";

export interface ProjectIdentity {
  readonly packageName: string;
  readonly displayName: string;
  readonly description?: string;
  readonly version?: string;
  readonly license?: string;
  readonly repository?: string;
  readonly homepage?: string;
  readonly bugsUrl?: string;
  readonly packageManager: "npm" | "pnpm" | "yarn" | "bun";
  readonly language: "typescript" | "javascript" | "mixed";
  readonly framework?: string;
  readonly runtime?: string;
  readonly projectType: ProjectTypeExt;
  readonly isMonorepo: boolean;
}

export interface ProjectPurpose {
  readonly summary: string;
  readonly problem?: string;
  readonly capabilities: readonly string[];
  readonly audiences: readonly string[]; // e.g. "library consumers", "cli users"
  readonly confidence: "deterministic" | "repository-derived" | "inferred";
}

export interface InstallationKnowledge {
  readonly packageManager: ProjectIdentity["packageManager"];
  readonly installCommand: string;
  readonly devInstallCommand?: string;
  readonly runtimeRequirements: readonly string[]; // Node >=20, etc.
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

export interface ConfigurationKnowledge {
  readonly configFiles: readonly string[];
  readonly configKeys: readonly { key: string; type?: string; description?: string; required?: boolean; defaultValue?: string }[];
  readonly envVars: readonly { name: string; purpose?: string; required?: boolean; defaultValue?: string; secret?: boolean }[];
}

export interface CliKnowledge {
  readonly commands: readonly {
    readonly name: string;
    readonly description?: string;
    readonly args?: readonly { name: string; required?: boolean; description?: string }[];
    readonly options?: readonly { flags: string; description?: string; defaultValue?: string }[];
    readonly aliases?: readonly string[];
    readonly examples?: readonly string[];
    readonly exitCodes?: readonly { code: number; meaning: string }[];
  }[];
}

export interface ArchitectureKnowledge {
  readonly modules: readonly { path: string; responsibility: string; inputs?: string; outputs?: string }[];
  readonly mermaidDiagrams: readonly { title: string; code: string }[];
  readonly directoryStructure: readonly { path: string; explanation: string }[];
}

export interface DependencyKnowledge {
  readonly runtime: readonly string[];
  readonly peer: readonly string[];
  readonly dev: readonly string[];
  readonly important: readonly { name: string; reason: string }[];
}

export interface ExampleKnowledge {
  readonly discovered: readonly { title: string; path?: string; code?: string; source: "examples" | "tests" | "readme" | "jsdoc" }[];
}

export interface DevelopmentKnowledge {
  readonly scripts: Readonly<Record<string, string>>;
  readonly testRunner?: string;
  readonly buildSystem?: string;
  readonly publishConfig?: { registry?: string; access?: string };
  readonly scriptBuckets?: Readonly<Record<string, readonly string[]>>;
}

export interface ProjectKnowledge {
  readonly identity: ProjectIdentity;
  readonly purpose: ProjectPurpose;
  readonly installation: InstallationKnowledge;
  readonly configuration: ConfigurationKnowledge;
  readonly api: { symbols: readonly ApiSymbol[] };
  readonly cli: CliKnowledge;
  readonly architecture: ArchitectureKnowledge;
  readonly dependencies: DependencyKnowledge;
  readonly environment: ConfigurationKnowledge["envVars"];
  readonly examples: ExampleKnowledge;
  readonly development: DevelopmentKnowledge;
  readonly graph?: KnowledgeGraph;
  readonly raw: {
    readonly packageJson?: Record<string, unknown>;
    readonly readmeExcerpt?: string;
  };
}
