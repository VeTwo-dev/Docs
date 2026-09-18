/**
 * Documentation Architecture Model.
 *
 * A first-class, renderer-independent description of an entire
 * documentation website — sections, pages, relationships, navigation,
 * learning paths, and coverage. Produced by the Documentation Knowledge
 * Compiler; consumed by planners, renderers, and validators.
 */

import type { DocumentationIR } from "./ir.js";
import type { DocumentationDiagnostic as Diagnostic } from "./diagnostics.js";

/** ─── Project Archetypes ────────────────────────────────────────────── */

/**
 * Project archetype characteristics. A project may exhibit several at once
 * (e.g. `framework + library`, `cli + development-tool`); the classifier
 * never forces a single type.
 */
export type ProjectArchetype =
  | "library"
  | "application"
  | "framework"
  | "runtime"
  | "cli"
  | "tool"
  | "sdk"
  | "backend"
  | "frontend"
  | "fullstack"
  | "plugin"
  | "monorepo"
  | "template"
  | "generator"
  | "build-tool"
  | "compiler"
  | "development-tool"
  | "service";

/** ─── Personas ──────────────────────────────────────────────────────── */

/** Documentation audience personas, ordered by inferred priority. */
export type DocumentationPersona =
  | "end-user"
  | "developer"
  | "api-consumer"
  | "application-developer"
  | "plugin-author"
  | "maintainer"
  | "contributor"
  | "operator"
  | "administrator"
  | "integrator";

/** ─── Page Classification ───────────────────────────────────────────── */

/** Semantic classification of a documentation page. */
export type PageKind =
  | "overview"
  | "concept"
  | "guide"
  | "tutorial"
  | "how-to"
  | "recipe"
  | "reference"
  | "api"
  | "configuration"
  | "cli-command"
  | "architecture"
  | "integration"
  | "plugin"
  | "example"
  | "faq"
  | "troubleshooting"
  | "migration"
  | "installation"
  | "quick-start"
  | "getting-started"
  | "development"
  | "testing"
  | "building"
  | "publishing"
  | "contributing"
  | "security"
  | "performance"
  | "deployment"
  | "changelog"
  | "release-notes";

/** ─── Visibility Boundaries ─────────────────────────────────────────── */

/**
 * Documentation boundary for symbols/APIs. Default documentation targets
 * `public` and user-relevant `semi-public` items only.
 */
export type SymbolBoundary =
  "public" | "semi-public" | "internal" | "private" | "generated" | "implementation-detail";

/** ─── Sections ──────────────────────────────────────────────────────── */

/** A top-level documentation section (e.g. "Getting Started"). */
export interface DocumentationSection {
  /** Stable section id (slug form, e.g. `"getting-started"`). */
  readonly id: string;
  /** Display title. */
  readonly title: string;
  /** Semantic kinds this section groups. */
  readonly kinds: readonly PageKind[];
  /** Why this section exists (evidence-based rationale). */
  readonly rationale: string;
  /** Child page slugs in display order. */
  readonly pages: readonly string[];
  /** Whether the user explicitly enabled/disabled this section. */
  readonly overridden?: boolean;
}

/** ─── Pages ─────────────────────────────────────────────────────────── */

/** Source evidence backing a page definition. */
export interface PageEvidence {
  readonly kind:
    | "symbol"
    | "file"
    | "config"
    | "command"
    | "graph"
    | "dependency"
    | "adapter"
    | "script"
    | "package";
  readonly value: string;
  /** Evidence-carried explanation (e.g. module responsibility), never invented. */
  readonly description?: string;
}

/** A single planned documentation page. */
export interface DocumentationPageDefinition {
  /** Stable page slug (may contain `/` for hierarchy). */
  readonly slug: string;
  /** Display title. */
  readonly title: string;
  /** Owning section id. */
  readonly sectionId: string;
  /** Semantic classifications (a page may carry multiple tags). */
  readonly kinds: readonly PageKind[];
  /** What the page should cover. */
  readonly summary: string;
  /** Symbols this page documents (empty for conceptual pages). */
  readonly symbols: readonly string[];
  /** Evidence grounding this page in the actual project. */
  readonly evidence: readonly PageEvidence[];
  /** Relative importance 0..1 (never surfaced raw to users). */
  readonly importance: number;
  /** Whether this is the canonical page for its concept(s). */
  readonly canonical?: boolean;
  /** Whether this page was consolidated from several smaller subjects. */
  readonly consolidatedFrom?: readonly string[];
  /** Parent slug when this page was split into children. */
  readonly splitFrom?: string;
  /** Estimated content depth. */
  readonly depth: "summary" | "standard" | "deep";
}

/** ─── Relationships ─────────────────────────────────────────────────── */

/** Kinds of relationships between documentation pages. */
export type DocumentationRelationshipKind =
  | "related"
  | "prerequisite"
  | "next-step"
  | "alternative"
  | "extends"
  | "implements"
  | "depends-on"
  | "configured-by"
  | "used-with"
  | "example-for"
  | "reference-for";

export interface DocumentationRelationship {
  readonly from: string;
  readonly to: string;
  readonly kind: DocumentationRelationshipKind;
  /** Short human-readable explanation of the relationship. */
  readonly reason?: string;
}

/** ─── Navigation ────────────────────────────────────────────────────── */

/** A navigation node mirroring the semantic hierarchy. */
export interface NavigationNode {
  readonly label: string;
  readonly slug?: string;
  children?: NavigationNode[];
}

/** Planned navigation structure with journey support. */
export interface DocumentationNavigation {
  /** Ordered sidebar tree derived from the architecture (not filesystem). */
  readonly sidebar: readonly NavigationNode[];
  /** The primary learning journey through the docs. */
  readonly primaryJourney: readonly string[];
  /** Optional secondary journeys (per persona / task). */
  readonly secondaryJourneys: Readonly<Record<string, readonly string[]>>;
  /** Deterministic breadcrumb trail per page slug. */
  readonly breadcrumbs: Readonly<Record<string, readonly { label: string; slug?: string }[]>>;
}

/** ─── Learning Paths & Coverage ─────────────────────────────────────── */

export interface DocumentationLearningPath {
  readonly name: string;
  readonly description: string;
  /** Ordered page slugs. */
  readonly steps: readonly string[];
  readonly persona: DocumentationPersona;
}

/** Coverage area tracked by the compiler. */
export type CoverageArea =
  | "apis"
  | "symbols"
  | "concepts"
  | "features"
  | "configuration"
  | "cli-commands"
  | "workflows"
  | "examples"
  | "integrations"
  | "architecture"
  | "plugins"
  | "errors"
  | "migration"
  | "installation"
  | "quick-start"
  | "development"
  | "testing"
  | "building"
  | "publishing"
  | "contributing"
  | "security"
  | "performance"
  | "deployment"
  | "changelog";

export interface AreaCoverage {
  readonly area: CoverageArea;
  /** Items that exist in the project and are documented. */
  readonly documented: readonly string[];
  /** Items that exist but are intentionally not documented (boundary rules). */
  readonly excluded: readonly string[];
  /** Items missing documentation (gaps worth acting on). */
  readonly gaps: readonly string[];
}

export interface DocumentationCoverage {
  readonly areas: readonly AreaCoverage[];
  /** 0..1 overall coverage of in-boundary subject matter. */
  readonly score: number;
}

/** ─── Project Description (compiler input) ──────────────────────────── */

/** Intelligence input consumed by the compiler. Derived from the existing
 * intelligence pipeline (scanner → symbols → references → knowledge graph →
 * framework intelligence) — never from re-scanning raw sources. */
export interface CompilerProjectInput {
  readonly rootDir: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  /** Raw characteristic signals used by the classifier. */
  readonly signals: {
    readonly hasBin?: boolean;
    readonly hasServer?: boolean;
    readonly hasCli?: boolean;
    readonly isMonorepo?: boolean;
    readonly framework?: string;
    readonly dependencies?: readonly string[];
    readonly peerDependencies?: readonly string[];
    readonly exportsCount?: number;
    readonly entryPoints?: readonly string[];
    readonly configKeys?: readonly string[];
    readonly commands?: readonly { name: string; description?: string }[];
    readonly plugins?: readonly string[];
    readonly examples?: readonly string[];
    /** Workspace package names/paths (monorepos). */
    readonly packages?: readonly string[];
    /** package.json script names actually present in the project. */
    readonly scripts?: readonly string[];
  };
  /** Public API surface (already boundary-filtered upstream if available). */
  readonly apis?: readonly {
    readonly name: string;
    readonly kind: string;
    readonly signature?: string;
    readonly description?: string;
    readonly sourceFile?: string;
    readonly boundary?: SymbolBoundary;
    readonly deprecated?: boolean;
    readonly deprecatedInFavorOf?: string;
  }[];
  /**
   * Rich API symbols from the semantic analyzer (Phase 21).
   * When provided, the orchestrator generates per-symbol IR blocks
   * (signatures, parameter tables, type displays) instead of thin
   * "Covered APIs" bullet lists.
   */
  readonly apiSymbols?: readonly {
    readonly id: string;
    readonly name: string;
    readonly qualifiedName: string;
    readonly kind: string;
    readonly returnType?: string;
    readonly typeParameters?: readonly {
      readonly name: string;
      readonly constraint?: string;
      readonly default?: string;
    }[];
    readonly parameters?: readonly {
      readonly name: string;
      readonly type: string;
      readonly description: string;
      readonly required: boolean;
      readonly defaultValue?: string;
      readonly rest: boolean;
    }[];
    readonly extends?: string;
    readonly implements?: readonly string[];
    readonly members?: readonly {
      readonly name: string;
      readonly kind: string;
      readonly signature: string;
      readonly description: string;
      readonly required: boolean;
      readonly static: boolean;
      readonly readonly: boolean;
      readonly access: string;
      readonly type?: string;
      readonly returnType?: string;
      readonly deprecated: boolean | string;
    }[];
    readonly enumMembers?: readonly {
      readonly name: string;
      readonly value: string | number;
      readonly description: string;
    }[];
    readonly documentation: {
      readonly summary: string;
      readonly params: readonly { readonly name: string; readonly description: string }[];
      readonly returns?: string;
      readonly examples: readonly {
        readonly title?: string;
        readonly code: string;
        readonly language: string;
      }[];
      readonly since?: string;
      readonly deprecated?: string;
      readonly throws: readonly { readonly type?: string; readonly description: string }[];
      readonly see: readonly { readonly text: string; readonly url?: string }[];
    };
    readonly sourceFile: string;
    readonly line: number;
    readonly column: number;
    readonly exported: boolean;
    readonly deprecated: boolean | string;
    readonly since?: string;
    readonly boundary: string;
  }[];
  /** Concept nodes extracted from the knowledge graph. */
  readonly concepts?: readonly {
    name: string;
    kind: string;
    relatedApis?: readonly string[];
    /** Evidence-derived explanation (e.g. module responsibility). */
    description?: string;
  }[];
  /** Existing authored docs that must be preserved. */
  readonly existingPages?: readonly {
    readonly slug: string;
    readonly title: string;
    readonly authoredByUser?: boolean;
  }[];
}

/** ─── The Architecture ──────────────────────────────────────────────── */

/** Complete architecture of a documentation website. */
export interface DocumentationArchitecture {
  readonly schemaVersion: 1;
  readonly project: {
    readonly name: string;
    readonly description?: string;
    readonly archetypes: readonly ProjectArchetype[];
    readonly personas: readonly { persona: DocumentationPersona; priority: number }[];
  };
  readonly sections: readonly DocumentationSection[];
  readonly pages: readonly DocumentationPageDefinition[];
  readonly relationships: readonly DocumentationRelationship[];
  readonly navigation: DocumentationNavigation;
  readonly learningPaths: readonly DocumentationLearningPath[];
  readonly coverage: DocumentationCoverage;
}

/** User configuration overrides applied over inferred defaults. */
export interface ArchitectureOverrides {
  readonly sections?: Readonly<Record<string, { enabled?: boolean; title?: string }>>;
  readonly excludePages?: readonly string[];
  readonly extraPages?: readonly {
    readonly slug: string;
    readonly title: string;
    readonly sectionId: string;
    readonly kinds?: readonly PageKind[];
  }[];
}

/** A validated, ranked documentation example ready for composition. */
export interface ComposedExample {
  /** Stable id (e.g. `jsdoc:createUser:0` or `file:examples/basic.ts`). */
  readonly id: string;
  /** Human-readable title. */
  readonly title: string;
  readonly code: string;
  readonly language: string;
  /** Where the example came from: JSDoc tag, repo file, etc. */
  readonly source: string;
  /** Owning API symbol name when extracted from JSDoc (for Related links). */
  readonly owner?: string;
  /** Short purpose line derived from surrounding documentation (never invented). */
  readonly purpose?: string;
}

/** ─── Compilation Result ────────────────────────────────────────────── */

/** Full result of compiling a documentation architecture + IR. */
export interface DocumentationCompilationResult {
  readonly architecture: DocumentationArchitecture;
  readonly ir: DocumentationIR;
  readonly diagnostics: readonly Diagnostic[];
}
