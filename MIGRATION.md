# Migration Guide — Old → New Source Layout

Phase 0 restructured `@vetwo/docs` into a layered architecture. Existing
internal and public imports keep working because the old paths are preserved
as re-export facades. This document maps every moved module.

## 1. Path Map

### Core → Pipeline + Engine

| Old path | New path | Notes |
|---|---|---|
| `src/core/pipeline.ts` | `src/pipeline/index.ts` | Pipeline orchestration |
| `src/core/context.ts` | `src/pipeline/context.ts` | `createBuildContext`, `freezeContext` |
| `src/core/index.ts` | `src/engine/index.ts` | `build()`, `createDocsEngine()`, `DocsEngine` |
| `src/core/index.ts` | `src/core/index.ts` | **Facade** re-exporting the engine + `createBuildContext` |

### Discovery → Scanner

| Old path | New path | Notes |
|---|---|---|
| `src/discovery/files.ts` | `src/scanner/files.ts` | `discoverDocFiles`, `discoverSourceFiles` |
| `src/discovery/project.ts` | `src/scanner/project.ts` | `detectProject`, `detectPM`, … |
| `src/discovery/index.ts` | `src/discovery/index.ts` | **Facade** re-exporting `src/scanner` |

### Renderers + Templates → Renderer

| Old path | New path | Notes |
|---|---|---|
| `src/renderers/index.ts` | `src/renderer/index.ts` | `createHtmlRenderer`, `Renderer` |
| `src/renderers/react.ts` | `src/renderer/react.ts` | React renderer |
| `src/renderers/react.css` | `src/renderer/react.css` | |
| `src/templates/index.ts` | `src/renderer/template.ts` | `createDefaultTemplate`, `Template` |
| `src/renderers/index.ts` | `src/renderers/index.ts` | **Facade** |
| `src/templates/index.ts` | `src/templates/index.ts` | **Facade** |

### Generator Reorganisation

| Old path | New path | Notes |
|---|---|---|
| `src/generator/analyzer.ts` | `src/analyzer/index.ts` | `analyzeProject`, `ProjectAnalysis` |
| `src/generator/analyzer.ts` | `src/generator/analyzer.ts` | **Facade** re-exporting the analyzer |
| `src/generator/config.ts` | `src/generator/core/config.ts` | `resolveGeneratorConfig` |
| `src/generator/config.ts` | `src/generator/config.ts` | **Facade** |
| `src/generator/types.ts` | `src/generator/core/types.ts` | `GeneratorContext`, page/metadata types |
| `src/generator/types.ts` | `src/generator/types.ts` | **Facade** |
| `src/generator/generators/*` | `src/generator/pages/*` | Page generators (overview, architecture, guides, configuration, CLI, FAQ, troubleshooting, examples) |
| `src/generator/generators/index.ts` | `src/generator/pages/index.ts` + `src/generator/generators/index.ts` | `runPageGenerators` and page exports; **facade** kept |
| `src/generator/metadata/*` | `src/generator/metadata/*` | Unchanged |
| `src/generator/cache.ts` | `src/generator/cache.ts` | Unchanged (`GeneratorCache`) |
| `src/generator/writers.ts` | `src/generator/writers.ts` | Unchanged (`writeGeneratedOutput`, …) |
| `src/generator/index.ts` | `src/generator/index.ts` | Unchanged (`generateDocs`) |

### New Layers (no old counterpart)

| New path | Responsibility |
|---|---|
| `src/engine/` | `DocsEngine`, `ServiceContainer`, contracts, services |
| `src/pipeline/` | Build context + pipeline orchestration |
| `src/scanner/` | File & project discovery |
| `src/analyzer/` | Project analysis |
| `src/compiler/` | Reserved compiler surface (interfaces only) |
| `src/graph/` | Universal knowledge graph (models, engine, visitors) |
| `src/renderer/` | HTML rendering + templates |

## 2. What Did NOT Change

- Public package exports (`src/index.ts` barrel): identical, verified against
  the built CJS bundle. `createDocsEngine` is intentionally **not** public.
- CLI commands and their behavior.
- All config options, defaults, and validation rules.
- Generated output (HTML, search index, sitemap, RSS, OG images).
- Coverage thresholds and lint/format rules.
- Tests: same assertions, same count, all passing.

## 3. Update Your Imports

Old paths still work, but new code should import from the new locations:

```ts
// Before
import { createBuildContext } from "@vetwo/docs/dist/core";
import { detectProject } from "@vetwo/docs/dist/discovery";

// After
import { createBuildContext } from "@vetwo/docs/dist/pipeline";
import { detectProject } from "@vetwo/docs/dist/scanner";
```

Internal callers of `src/core/index.js` (engine/build entry) should move to
`src/engine/index.js`.

## 4. Test Suite Notes

- Temp project directories in tests moved to `os.tmpdir()` (previously
  `src/*/__*_test__`), which removed a cross-test flake where discovery
  globbed test-created directories inside `src/`.
- The cwd-fallback engine test runs in an isolated child process
  (`test/cwd-fallback.test.ts`, invoked via `vitest.cwd.config.ts`) because
  `process.chdir` is process-global and would otherwise race with parallel
  test files.

## 5. Phase 1 — Universal Project Scanner Engine

Phase 1 did **not** move any existing path. It added a new internal subsystem
in `src/scanner/` (plus thin wiring on the engine) while keeping every legacy
module path importable.

### New scanner layout

```
src/scanner/
├── index.ts                 facade: exports the new engine types + ALL legacy
│                            functions (detectProject, detectPM, …) unchanged
├── types/                   ScanOptions, ProjectModel, ScanEvent, …
├── models/                  ProjectModel, ScannedFile, ProjectInfo, …
├── utils/                   glob matcher, path utils, hash, extensions
├── filters/                 ignore (gitignore semantics), resource kinds
├── classifiers/             file, directory, config, asset, project
├── providers/               ScannerProvider (types) + local + memory
├── discovery/               project, workspace, packages, resources
├── cache/                   scan cache + persistence
├── engine/                  full scan, incremental diff, engine, watch
└── watch/                   event types + provider-backed watcher
```

### Engine wiring (new — no old counterpart)

| New entry | Location | Notes |
|---|---|---|
| `DiscoveryService.scanProject(rootDir, options?)` | `src/engine/services/discovery-service.ts` | Backed by the Project Scanner Engine |
| `DocsEngine.runScanner(rootDir, options?)` | `src/engine/index.ts` | Standalone scanner entry; returns `ProjectModel` |

The legacy functions are now implemented on top of (or alongside) the new
engine but keep their exact signatures and semantics, so `src/discovery/*`
and `src/scanner/files.ts` / `src/scanner/project.ts` imports are unaffected.

### What did NOT change in Phase 1

- Public package exports (`src/index.ts` barrel): still the same 12, verified
  byte-identical against the built CJS bundle.
- CLI behavior; config options; generated output; renderers; coverage
  thresholds; lint/format rules.
- No AST parsing, symbol analysis, or doc generation was introduced.

### Import guidance for Phase 1

```ts
// Still correct (legacy paths unchanged)
import { detectProject } from "@vetwo/docs/dist/scanner";
import { discoverDocFiles } from "@vetwo/docs/dist/discovery";

// New: full project index
const model = await engine.runScanner(rootDir);   // ProjectModel
const model2 = await discovery.scanProject(rootDir, { include: ["**/*.ts"] });
```

Internal-only convention: new scanner code consumes the `ScannerProvider`
boundary (never `node:fs`) so it can run against the in-memory provider in
tests and, in future, non-local roots.

## 6. Phase 2 — Universal Language Adapter System

Phase 2 added a new internal subsystem in `src/languages/`. No existing path
moved; the public API and `build()` behaviour are unchanged.

### New language subsystem layout

```
src/languages/
├── index.ts                 facade: createLanguageManager, extension API,
│                            built-in adapters, contracts, models, utils
├── contracts/               LanguageAdapter (universal contract), metadata,
│                            capabilities, configuration, framework,
│                            comment, detection, diagnostics
├── models/                  immutable LanguageModel + nested models
├── registry/                LanguageRegistry + secondary indexes
├── manager/                 LanguageManager (single entry point)
├── utils/                   extension, version, capabilities, metadata,
│                            config, detection helpers
└── builtin/                 shared/ + typescript/ + javascript/ adapters
```

### Engine wiring (new — no old counterpart)

| New entry | Location | Notes |
|---|---|---|
| `DocsEngine.languages` | `src/engine/index.ts` | Lazily-created `LanguageManager` (built-in adapters pre-registered), disposed with the engine |
| `createLanguageManager(options?)` | `src/languages/index.ts` | Standalone manager entry |
| `createLanguageAdapter(config)` | `src/languages/contracts/adapter.ts` | Factory for external language packages |
| `registerLanguage(adapter, manager)` | `src/languages/index.ts` | One-line registration for external adapters |

The scanner and language subsystems interoperate: a scanner `ProjectModel`
can be turned into a `DetectionInput` via
`detectionInputFromProjectModel`, so language detection consumes project
structure automatically.

### What did NOT change in Phase 2

- Public package exports (`src/index.ts` barrel): still the same 12, verified
  byte-identical against the built CJS bundle. `src/languages` is **not**
  exported publicly — reach it via `engine.languages`.
- CLI behavior; config options; generated output; renderers; coverage
  thresholds; lint/format rules.
- No AST parsing, symbol extraction, semantic analysis, doc-generation
  changes, AI, or compiler logic was introduced.

### Import guidance for Phase 2

```ts
// Engine access (recommended)
const engine = createDocsEngine({ rootDir });
const manager = engine.languages;                 // LanguageManager
manager.has("typescript");                        // true (built-in)
manager.detect({ files: ["src/index.ts"] });      // DetectionResult[]

// External language packages
import { createLanguageAdapter, createLanguageManager } from "@vetwo/docs/languages";
const manager = createLanguageManager();
manager.register(createLanguageAdapter({ metadata: { id: "python", ... }, capabilities: {...} }));
```

External packages ship a language by exporting an adapter built with
`createLanguageAdapter`; registration happens through the manager — no core
modification required.

## 7. Phase 3 — Universal Compiler Layer

Phase 3 introduces the Compiler Layer: `src/compiler` is new (no old
counterpart). It owns all native parser/compiler interaction.

### New compiler layer layout

```
src/compiler/
  manager/     CompilerManager · compile pipeline · sessions · events
  registry/    CompilerRegistry (index by id/language/extension)
  builtin/     typescript (native, lazy) · javascript (Babel, lazy)
  cache/       per-file hashes, units, dependency edges, result store
  contracts/   CompilerAdapter · AdapterCompileInput · capability types
  models/      CompilationUnit · CompilationResult · SourceMap · Context
  diagnostics/ normalization (TS + Babel → unified CompilerDiagnostic)
  shared/      hash · emitter · fingerprinting · extension helpers
  index.ts     (internal barrel — NOT a public entry point)
```

### Engine wiring (new — no old counterpart)

`src/engine/index.ts` lazily exposes `engine.compiler` (a
`createCompilerManager({ languages: this.languages })`). `dispose()` now also
tears down the compiler manager and its incremental sessions.

### What did NOT change in Phase 3

- The public API (`src/index.ts`) is byte-identical — still 12 exports.
- No symbol extraction, semantic analysis, doc-generation, or AI work was
  introduced.

### Import guidance for Phase 3

```ts
// Engine access (recommended)
const engine = createDocsEngine({ rootDir });
const manager = engine.compiler;                  // CompilerManager
manager.has("typescript");                        // true (built-in)

const result = await manager.compile({
  rootDir,
  files: ["src/index.ts"],
  contents: { "src/index.ts": "export const x = 1;" },
});
result.ok;                                        // false when diagnostics exist
result.units[0].status;                           // "ok" | "failed" | "skipped"

// External compiler packages
import { createCompilerManager, createCompilerAdapter } from "@vetwo/docs/compiler";
const manager = createCompilerManager();
manager.register(createCompilerAdapter({ metadata: { id: "rust", ... }, compile: ... }));
```

External packages ship a compiler by exporting an adapter built with
`createCompilerAdapter`; registration happens through the manager — no core
modification required. Native modules (TypeScript, Babel) are loaded lazily
inside their adapters, never eagerly.

## 8. Phase 4 — Universal Symbol Extraction Engine

Phase 4 introduces the Symbol Extraction Engine: `src/symbols` is new (no old
counterpart). It consumes the Phase 3 compiler layer and produces a
normalized, language-independent symbol model.

### New symbol layer layout

```
src/symbols/
  engine/      SymbolEngine · extract(request) · cache wiring · roots
  extractors/  shared node-walk core · typescript · javascript
  registry/    SymbolExtractorRegistry (resolve by language, hooks)
  models/      Symbol · SymbolInput · metadata · relationships · diagnostics
  contracts/   SymbolExtractor · SymbolExtractionInput/Output · capabilities
  graph/       derived structural graph (owns/imports/exports edges)
  cache/       per-file hash → symbols, rebuild with shared store
  diagnostics/ declaration-level detection + summaries
  visitors/    collectSymbols · visitSymbols · ancestors/children/leaves
  filters/     ofKind / ofLanguage predicates
  shared/      ids · names · doc parsing · hash
  index.ts     (internal barrel — NOT a public entry point)
```

### Engine wiring (new — no old counterpart)

`src/engine/index.ts` lazily exposes `engine.symbols` (a
`createSymbolEngine({ languages: this.languages, compilers: this.compiler })`).
`dispose()` now also disposes the symbol engine and its cache.

### What did NOT change in Phase 4

- The public API (`src/index.ts`) is byte-identical — still 12 exports.
- No semantic analysis, type resolution, knowledge graph, AI, or doc
  generation was introduced — structural extraction only.

### Import guidance for Phase 4

```ts
// Engine access (recommended)
const engine = createDocsEngine({ rootDir });
const symbols = engine.symbols;                     // SymbolEngine

const result = await symbols.extract({
  rootDir,
  files: ["src/index.ts"],
  contents: { "src/index.ts": "export const x = 1;" },
});
result.project;                                     // project root symbol
result.packages;                                    // package symbols
result.modules;                                     // module (file) symbols
result.symbols;                                     // everything, one store
result.graph;                                       // derived structural graph

// External extractor packages
import { createSymbolEngine, createSymbolExtractor } from "@vetwo/docs/symbols";
const engine = createSymbolEngine();
engine.registry.register(
  createSymbolExtractor({
    metadata: { id: "rust", languageId: "rust", ... },
    capabilities: {},
    extract: ({ units }) => ({ /* SymbolExtractionOutput */ }),
  }),
);
```

## 9. Phase 5 — Universal Reference Resolution Engine

Phase 5 introduces the Reference Resolution Engine: `src/references` is new
(no old counterpart). It consumes the Phase 4 symbol model and resolves
name-level references (imports, exports, heritage, type-uses, throws, docs)
into frozen `Reference` records and a serializable `ReferenceGraph`.

### New reference layer layout

```
src/references/
  engine/      ReferenceEngine · resolve(request) · cache wiring · statistics
  resolvers/   shared binding extractor · typescript · javascript
  registry/    ReferenceResolverRegistry (resolve by language, capabilities)
  models/      Reference · ReferenceBinding · PerLanguageResolution · stats
  contracts/   ReferenceResolver · ReferenceResolutionInput/Output · capabilities
  scope/       lexical lookups (local < imported < exported) + shadowing
  graph/       resolved reference graph (from → to, toId only when found)
  cache/       per-file hash → bindings, rebuild with cached bindings
  diagnostics/ missing-resolver detection + summaries
  visitors/    collectReferences · visitReferences · pruning
  filters/     ofKind / ofLanguage / resolved predicates
  shared/      ids · helpers
  index.ts     (internal barrel — NOT a public entry point)
```

### Engine wiring (new — no old counterpart)

`src/engine/index.ts` lazily exposes `engine.references` (a
`createReferenceEngine({ languages })`). `resolve()` compiles requested files
through the symbol engine and returns per-language resolutions, statistics and
the shared graph. `dispose()` now also disposes the reference engine and its
cache.

### What did NOT change in Phase 5

- The public API (`src/index.ts`) is byte-identical — still 12 exports.
- No AI, doc generation, or a full semantic type system was introduced —
  resolution is name-based and structural.

### Import guidance for Phase 5

```ts
// Engine access (recommended)
const engine = createDocsEngine({ rootDir });
const references = engine.references;               // ReferenceEngine

// Symbol extraction feeds resolution (see Phase 4)
const extraction = await engine.symbols.extract({ rootDir, files, contents });

const result = references.resolve({ rootDir, extraction, units });
result.resolutions;                                 // per-language resolutions
result.statistics;                                  // resolved/unresolved counts
result.references;                                  // frozen Reference records
result.graph;                                       // serializable ReferenceGraph

// External resolver packages
import { createReferenceEngine, createReferenceResolver } from "@vetwo/docs/references";
const engine = createReferenceEngine();
engine.registry.register(
  createReferenceResolver({
    metadata: { id: "rust", languageId: "rust", ... },
    capabilities: {},
    resolve: ({ modules }) => ({ /* ReferenceResolutionOutput */ }),
  }),
);
```

## Phase 6 — Universal Knowledge Graph

### What was added (new — no old counterpart)

`src/graph/` implements the universal, serializer-friendly graph that unifies
the per-subsystem graph work into one derived structure. The layout:

```
src/graph/
  models/        GraphNode, GraphEdge, GraphGraph, kinds + model tests
  contracts/     GraphContributor contract + contract tests
  registry/      ContributorRegistry (ordered, iteration, safe-list)
  contributors/  structural.ts + references.ts built-in contributors
  filters/       kind/field predicates for edge & node filtering
  visitors/      collectNodes / collectEdges / collectSymbols traversal
  shared/        stable id normalization helpers
  engine/        GraphEngine facade (sync, node, neighbors, stats, dispose)
  index.ts       barrel
```

`src/graph/index.ts` replaces the Phase 1 placeholder (`RESERVED` / type-only
exports). The public barrel is untouched.

### Engine wiring (new — no old counterpart)

`src/engine/index.ts` lazily exposes `engine.graph` (a `createGraphEngine()`).
`sync()` runs the registered contributors (structural, references) over the
current symbols/references snapshots; each contributor gates its own work on
data availability, so the graph stays consistent whether or not references
were resolved. `dispose()` also disposes the graph engine.

### Import guidance for Phase 6

```ts
// Engine access (recommended)
const engine = createDocsEngine({ rootDir });
const graph = engine.graph;                          // GraphEngine

// Populate the graph (idempotent — re-runs safe)
graph.sync();

// Navigate
const circle = graph.node("c:Circle");
const neighbors = graph.neighbors(circle!.id);       // node ids
graph.statistics;                                    // nodeKinds / edgeKinds
graph.edges.filter((e) => e.kind === "imports");     // typed GraphEdge[]

// Visitors return stable ids
import { collectNodes, collectEdges } from "@vetwo/docs/graph";
collectNodes(graph, "c:Circle", { edgeKinds: ["references"] });
```

### What did NOT change in Phase 6

- The public API (`src/index.ts`) is byte-identical — still 12 exports.
- No AI, doc generation, or a full semantic type system was introduced — the
  graph is structural and derives from symbols + resolved references.
- `src/graph` depends only on the compiler layer, language adapters, symbols,
  references, shared contracts and utils.

## New subpaths in Phases 11–12 (no old counterpart)

The example engine, relationship engine and their integration layer ship as
new subpath exports — there is no pre-existing path to migrate from.

| Subpath | Exports |
|---|---|
| `@vetwo/docs/examples` | `extractExamples`, `extractDocumentationExamples`, `createExampleRegistry`, `createExample`, `createExampleProvenance`, `createExampleGap`, `ExampleType`, `ExampleProvenance`, `ExampleDiagnostics`, default extractor set |
| `@vetwo/docs/documentation-relations` | `deriveRelationships`, `createRelationshipRegistry`, `RelationshipKind`, `Relationship`, `PageDescriptor`, `NavigationGraph`, `LearningPath`, `RelationshipDiagnostics`, default resolver set |
| `@vetwo/docs/intelligence` | `buildDocumentationIntelligence`, `DocumentationIntelligence`, `createExampleContext`, `createExampleGapContext`, `createPageRelationshipContext`, `createLearningPathContext`, `createDocumentationPlanningContext`, `buildSkillIntelligenceManifest` |

All three are also available as namespaces on the root export
(`@vetwo/docs` → `examples`, `documentationRelations`, `intelligence`).

### Import guidance for Phases 11–12

```ts
import { extractExamples } from "@vetwo/docs/examples";
import { deriveRelationships } from "@vetwo/docs/documentation-relations";
import { buildDocumentationIntelligence } from "@vetwo/docs/intelligence";

const docs = buildDocumentationIntelligence({
  files: [{ path: "README.md", content }, ...],
  pages: [/* PageDescriptor[] */],
  exampleOptions: { evidence: { knownSymbols, knownPackages } },
});
docs.examples;          // Example[]
docs.relationships;     // Relationship[]
docs.navigation;        // Map<pageId, NavigationEntry>
docs.summary;           // machine-readable counts
```

### What did NOT change in Phases 11–12

- The public API (`src/index.ts`) keeps its 12 original exports (three
  namespaces are additive).
- No AI, doc generation, or renderer changes were introduced; extraction and
  derivation are evidence-backed and never mutate user files.
- The new engines are **not** wired into the default `build()` pipeline —
  they are opt-in subpath imports.
- `src/examples`, `src/documentation-relations` and `src/intelligence` depend
  only on shared contracts, models, `src/graph` and utils — never on
  generator/renderer/themes/CLI/search/AI.

## State boundary (`.vetwo/docs/`)

Engine-internal state moved from a set of scattered, package-private
directories into a single git-ignored state root at the workspace root. The
migration is safe, idempotent and automatic during `docs init` (or on demand
via the state manager's `migrate()`).

### 1. Path map

| Old | New | Automatic? |
|---|---|---|
| `<root>/.docs-cache/manifest.json` | `.vetwo/docs/compiler/manifest.json` | yes — owned |
| `<root>/.docs-cache/<16-hex>.json` | `.vetwo/docs/compiler/<16-hex>.json` | yes — owned |
| `<root>/.docs-cache/generator-manifest.json` | `.vetwo/docs/generator/generator-manifest.json` | yes — owned |
| `<root>/.docs-cache/scanner-cache.json` | `.vetwo/docs/scanner/scanner-cache.json` | yes — owned |
| `.vetwo/docs/cache/general/*` (v1) | `.vetwo/docs/compiler/*` | yes — relocated |
| `.vetwo/docs/cache/scanner/*` (v1) | `.vetwo/docs/scanner/*` | yes — relocated |
| `.vetwo/docs/cache/generator/*` (v1) | `.vetwo/docs/generator/*` | yes — relocated |
| `<docs>/.vetwo/manifest.json` | `.vetwo/docs/manifests/workspace.json` | rewrite on next `docs init` |
| `<docs>/.cache`, `<docs>/cache`, `<wiki>/.cache`, `<wiki>/cache` | — | no — detected, never touched |
| new | `.vetwo/docs/state.json` | n/a |
| new | namespace dirs such as `compiler/`, `scanner/`, `manifests/` (created lazily on first use) | n/a |

Only files provably owned by the package (`.docs-cache/*`) are migrated;
copies are verified byte-for-byte before the originals are removed. A
`.migrating` marker file makes interrupted runs resumable, and re-running
migration is a no-op.

### 2. Import guidance

The state module ships as a subpath and a root namespace:

```ts
import { createDocsStateManager } from "@vetwo/docs/state";
// or: import { state } from "@vetwo/docs";

const state = createDocsStateManager({ rootDir, fs, project: "acme" });
state.initialize();          // writes .vetwo/docs/state.json (merged, atomic)
state.migrate();             // moves legacy .docs-cache content + relocates v1 layout
state.ensureNamespace("scanner"); // lazily create + record .vetwo/docs/scanner/
state.resolve("manifests", "workspace.json"); // -> absolute path
```

Subsystems writing through their own filesystem use the same central path:

```ts
import { ensureStateNamespace } from "@vetwo/docs/state";
ensureStateNamespace(rootDir, "compiler"); // -> .vetwo/docs/compiler/
```

### 3. What did NOT change

- User-facing output (`docs/`, `wiki/`) and the agent workspace (`agent/`)
  are untouched by the state boundary.
- `docs clean --state` removes safe regenerable internal state (indexes,
  graphs, analysis) but never manifests; unknown or user-owned directories
  are never touched. The default `clean` clears cache/temporary/reports/
  diagnostics only.
- `.docs-cache/` remains ignored in `DEFAULT_IGNORE_PATTERNS` for projects
  that have not migrated yet; `.vetwo/` is ignored alongside it.
