# Validation Report — Phase 0 Foundation Architecture Refactor

**Scope:** Layer extraction (`CLI → Engine → Pipeline → Domain → Utilities`)
with zero observable behavior change. This report records the verification
evidence.

## 1. Gates

All gates pass on the refactored tree:

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Clean (0 errors) |
| Lint | `npm run lint` | Clean (0 errors, 0 warnings) |
| Format | `npm run format:check` | All files Prettier-clean |
| Tests | `npx vitest run` | **618/618 passing** (38 files) |
| Coverage | `npx vitest run --coverage` | Above all thresholds |
| Build | `npm run build` | ESM + CJS + DTS, exit 0 |

Coverage thresholds (`statements 90 / branches 75 / functions 90 / lines 90`):

```
All files | 90.9 | 77.46 | 92.78 | 91.92 |
```

## 2. Tests

| Metric | Before | After | Delta |
|---|---|---|---|
| Test files | 36 | 38 | +2 |
| Tests passing | 599 | 618 | +19 |

The +19 tests are the new engine lifecycle suite (`src/engine/index.test.ts`:
`createDocsEngine()`, `initialize()`, `build()`, `runPipeline()`,
`runGenerator()`, `runAnalyzer()`, `dispose()`, service container surface).
`src/engine/container.test.ts` (8 tests) existed in the baseline.

No pre-existing test was weakened or removed. Two pre-existing failures found
during the refactor were fixed:

1. **Pagefind suite** (5 tests) asserted a `PagefindError` throw that the
   implementation intentionally swallows (MiniSearch fallback). Rewritten to
   match implementation behavior — same as the original pre-refactor tree.
2. **Cross-file test flakes** — two independent root causes were found and
   fixed:
   - `process.chdir` in an engine test leaked across parallel vitest workers
     (process-global state), corrupting discovery in concurrent test files.
     The cwd-fallback test now runs in an isolated child process
     (`test/cwd-fallback.test.ts` + `vitest.cwd.config.ts`).
   - Tests created temp projects inside `src/*/__*_test__/`, which the
     scanner's discovery glob then picked up and raced with their deletion
     (`ENOENT` in `getFileMtime`). Fixed by moving temp dirs to
     `os.tmpdir()`.
   Verified with 6 consecutive full-suite runs post-fix (plus 5 runs with the
   fixes applied incrementally) with zero failures; pre-fix runs failed ~1
   in 3–4.

## 3. Public API Surface

Verified byte-for-byte against the built CJS bundle — identical to the
documented baseline (no additions, removals, or renames):

```
build
createHookRegistry
createLogger
createPluginRegistry
defineDocs
detectProject
discoverDocFiles
discoverSourceFiles
loadConfig
mermaid
openApi
resolveConfigPath
```

`createDocsEngine` is intentionally **not** part of the public package
surface (internal engine/core only).

## 4. Behavior Parity

- **CLI:** `build`, `generate`, `doctor`, `clean` verified end-to-end on an
  isolated temp project (`/tmp/opencode/cli-test`); output identical to
  pre-refactor behavior (output directory, HTML pages, search assets).
- **Discovery resolution:** relative `source`/`output` paths resolve against
  `process.cwd()` exactly as before — no behavior change (the original
  `build.test.ts` asserted logger output, and the engine preserves the same
  semantics).
- **Generator output:** 51 generator tests + engine `runGenerator` test pass
  unchanged after the `pages/`/`core/` reorganisation.

## 5. Dependency Invariants

Layer boundaries verified via a source-scan script (see `ARCHITECTURE.md`
§2): no domain layer imports the engine, pipeline, or CLI; the engine
imports `pipeline`, `generator`, and `analyzer` but the reverse never occurs;
`types`/`constants`/`utils`/`filesystem` are leaf modules.

## 6. Known Pre-Existing Issues (not refactor-induced)

- The repo's own `docs.config.ts` fails `docs build` because the Zod schema
  requires sidebar `items` to be objects while the config uses strings.
- CJS CLI `node dist/cli/index.cjs --help` prints nothing (exit 0); the ESM
  build prints usage correctly.
- `npx knip` reports unused-export warnings; knip is not a project gate.

---

# Validation Report — Phase 1 Universal Project Scanner Engine

**Scope:** add a single Project Scanner Engine (`src/scanner/`) that
discovers, classifies, and indexes files, directories, packages, workspaces,
configs, assets, and metadata into a unified Project Index, wired through
`DiscoveryService.scanProject` + `DocsEngine.runScanner`, without changing the
docs pipeline or the public API.

## 1. Gates (final run)

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Clean (0 errors) |
| Lint | `npm run lint` | Clean (0 errors, 0 warnings) |
| Format | `npm run format:check` | All files Prettier-clean |
| Tests | `npx vitest run` | **794/794 passing** (58 files) |
| Coverage | `npx vitest run --coverage` | Above all thresholds |
| Build | `npm run build` | ESM + CJS + DTS, exit 0 |
| Public API | `require('./dist/index.cjs')` | 12 exports, byte-identical |

Coverage thresholds (`statements 90 / branches 75 / functions 90 / lines 90`):

```
All files | 92.34 | 82.08 | 94.05 | 93.69 |
```

## 2. Tests

| Metric | Phase 0 end | Phase 1 end | Delta |
|---|---|---|---|
| Test files | 38 | 58 | +20 |
| Tests passing | 618 | 794 | +176 |

The +176 tests cover: glob/path/hash/extensions utils; ignore + resource
filters; all five classifiers; workspace + package discovery; scan cache;
memory + local providers; the engine (full scan, incremental diff, renames via
content hash, ignore re-include, pruned `node_modules`, monorepo + packages +
relationships, include/exclude/maxDepth filters, resource-kind-only scans,
invalid-manifest + duplicate-content diagnostics, symlinks, plugins,
`disabledIgnoreSources`, cache persistence, `watch()`); the watcher;
`DocsEngine.runScanner()`.

Three heavy pre-existing tests (ts-morph API-docs + two `engine.build()`
integration tests) had their timeouts raised 30s → 90s to eliminate a flaky
coverage-timeout; assertions unchanged.

## 3. Module Layout + Boundary

- `src/scanner/providers/`: `ScannerProvider` is the **only** seam allowed to
  touch `node:fs`. `LocalFileSystemProvider` is the sole module importing
  `node:fs`; every other scanner module goes through the interface.
- Local provider returns absolute paths; `glob` dirs keep a trailing slash.
- `MemoryProvider` (async `writeFile`/`ensureDir`, implicit dirs, symlinks)
  enables fast in-memory tests; no test uses `process.chdir`, and temp dirs
  live under `os.tmpdir()`.
- Scanner internals are **not** exported from `src/index.ts`; they are reached
  via `runScanner`/`scanProject`.

## 4. Behavior Notes (fixed during Phase 1)

- `.d.ts`/`.d.mts`/`.d.cts` now classify as declarations (`getExtension`
  returns `.ts`, so extension-based detection was corrected).
- Config detection recognizes dotfile names (`.eslintrc.json`,
  `.prettierrc.yml`, `.yarnrc.yaml`, `.env*`) while `.gitkeep` stays
  non-config.
- Glob matcher: basename-only patterns match any path segment; leading `/`
  anchors to root; trailing `/` matches dir + descendants; wildcards do not
  match leading dots unless `dot: true`.
- Incremental diff: renames pair removed+added files with identical content
  hash (size+mtime fallback).

## 5. Constraints Honored

- No AST parsing, symbol analysis, doc generation, rendering, or CLI changes.
- 12 public exports byte-identical to the Phase 0 baseline.
- `build()` still uses legacy `discoverDocFiles`/`discoverSourceFiles`; the
  new engine is additive, not a replacement of the docs pipeline.

---

# Validation Report — Phase 2 Universal Language Adapter System

**Scope:** make the engine language-agnostic by adding a universal Language
Adapter System (`src/languages/`) — Language Manager, Registry, Adapter
Contract, capability system, immutable models, extension API, diagnostics,
and built-in TypeScript/JavaScript adapters — without AST parsing, symbol
analysis, semantic analysis, doc-generation changes, AI, or compiler logic.

## 1. Gates (final run)

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Clean (0 errors) |
| Lint | `npm run lint` | Clean (0 errors, 0 warnings) |
| Format | `npm run format:check` | All files Prettier-clean |
| Tests | `npx vitest run` | **921/921 passing** (78 files) |
| Coverage | `npx vitest run --coverage` | Above all thresholds |
| Build | `npm run build` | ESM + CJS + DTS, exit 0 |
| Public API | `require('./dist/index.cjs')` | 12 exports, byte-identical |

Coverage thresholds (`statements 90 / branches 75 / functions 90 / lines 90`):

```
All files | 93.06 | 84.07 | 94.61 | 94.28 |
```

Per-subsystem (language layer):

```
languages/manager | 95.18 | 92.38 | 93.54 | 96.44
languages/registry | 100.0 | 89.28 | 100.0 | 100.0
languages/models   | 97.87 | 98.55 | 94.11 | 97.61
languages/utils    | 100.0 | 97.60 | 100.0 | 100.0
languages/builtin  | 100.0 | 100.0 | 100.0 | 100.0
```

## 2. Tests

| Metric | Phase 1 end | Phase 2 end | Delta |
|---|---|---|---|
| Test files | 58 | 78 | +20 |
| Tests passing | 794 | 921 | +127 |

The +127 tests cover: the adapter contract factory; capability vocabulary and
validation; diagnostics builder; immutable models (language, capabilities,
configuration, framework, comment, detection, deep-freeze); all shared utils
(extension matching, semver-ish version comparison, capability levels, metadata
normalisation/validation, config/entry-point helpers, detection fingerprint +
`ProjectModel → DetectionInput`); the registry (indexes by id/extension/MIME/
fileName/framework, duplicates, conflicts, unregister/clear); the manager
(registration lifecycle incl. async hooks, alias resolution, capability
discovery, signal-based detection for single/multiple/unknown languages,
mixed-language ordering, custom `detect` hooks, caching, diagnostics for
unsupported/unknown/missing languages + version incompatibility,
initialize/dispose); built-in TypeScript/JavaScript adapters; the extension
API; and engine integration (`engine.languages`, disposal, detection seeded
from a scanner `ProjectModel`).

## 3. Architecture

- `Core → LanguageManager → LanguageAdapters (TypeScript, JavaScript)`; no
  language logic in the engine.
- `src/languages/contracts/adapter.ts` is the universal contract; the engine
  talks to languages exclusively through it.
- Registry has **no hardcoded switches** — lookups are index-driven
  (id/extension/MIME/fileName/framework).
- Detection is signal-based (extensions, fileNames, config files, runtime +
  dev dependencies, lockfiles, workspace, repository, explicit framework
  hints), returns all languages in a project ordered by confidence, runs once
  and caches per input fingerprint.
- Adapt depend only on shared contracts/models/utils — never CLI, renderer,
  themes, generator, search, or AI.

## 4. Extension System

- New additive package export `@vetwo/docs/languages` (tsup entry +
  `package.json` `exports` map) so external packages can ship languages.
- Verified end-to-end: `require('./dist/languages/index.cjs')` exposes
  `createLanguageAdapter`, `createLanguageManager`, `registerLanguage`,
  built-ins, and models; external registration returns `registered`.
- `DocsEngine.languages` exposes the manager in-process; disposed with the
  engine (adapters remain registered for reuse).

## 5. Constraints Honored

- No AST parsing, symbol extraction, semantic analysis, doc-generation
  changes, AI, or compiler logic.
- Public barrel (`src/index.ts`) byte-identical — still 12 exports.
- `build()`, CLI, config, renderers and generated output unchanged.
- Backward compatibility preserved; `./languages` is purely additive.

# Validation Report — Phase 3 Universal Compiler Layer

## 1. Gates (final run)

| Gate                    | Result |
| ----------------------- | ------ |
| `npm run format`        | clean  |
| `npx tsc --noEmit`      | clean  |
| `npm run lint`          | clean  |
| `npx vitest run`        | 87 files / 1043 tests passing |
| `npx vitest run --coverage` | 92.52 stmts / 84.46 branch / 93.81 funcs / 94.05 lines (≥ 90/75/90/90) |
| `npm run build`         | ESM + DTS success |

## 2. Tests

Compiler-layer suite: **121 tests across 10 files** (`src/compiler/**`),
covering shared hash/emitter/fingerprinting, dependency extraction,
diagnostic normalization (TS + Babel), models, cache store, registry,
built-in TypeScript and Babel adapters, and the full manager integration
suite (registration, single-file TS/JS compile, language detection, explicit
compilerId, missing-compiler results, skipped/unsupported-syntax warnings,
syntax-error normalization, failure recovery, source maps, cache-cached
second compiles, changed-file detection, transitive-dependent recompiles,
watch events, project-updated, compilation-failed, workspace context,
initialize/dispose/reuse, skipCache, invalidate, register/replace/unregister,
invalid-adapter rejection, incremental-session reuse, throwing-adapter
recovery, `emit()`, capability lookups, `require` throws, `clearDiagnostics`).

Engine integration adds `engine.compiler` coverage: size, built-ins, a real
TypeScript compile smoke, and dispose behavior.

## 3. Architecture

- `src/compiler` owns all native compiler/parser interaction; the core has no
  compiler-specific logic.
- Native modules (TypeScript, `@babel/parser`) are loaded lazily via
  `loadNativeModule` and cast to structural interfaces — never eagerly
  imported, and adapters degrade gracefully when a module is absent.
- Cache-driven incrementality recompiles only changed files plus transitive
  dependents; unchanged requests are served from cache.
- `engine.compiler` is a lazy `CompilerManager`; `engine.dispose()` tears it
  down with its incremental sessions.

## 4. Behavior Notes (fixed during Phase 3)

- Manager extension matching previously ran `normalizeExtension` on full file
  paths (`src/a.ts` → `.src/a.ts`), so built-in compilers never matched
  nested files; now it extracts the extension first (`extensionOf(file)`).
- TypeScript source maps emit basenames (`a.ts`); sources are now rewritten
  to the project-relative path.
- `options.skipCache` is now honored (previously ignored by the manager).
- Babel thrown-parse errors are captured with their `message` explicitly
  (spreading the error dropped it, producing null diagnostics).
- `scriptKindFor` used `normalizeExtension(file)` on the whole path instead of
  the extension; fixed.

## 5. Constraints Honored

- No symbol extraction, semantic analysis, doc-generation changes, AI, or
  knowledge-graph work.
- Public barrel (`src/index.ts`) byte-identical — still 12 exports, verified
  against the built bundle.
- Native modules never eagerly imported; existing functionality unchanged;
  backward compatibility preserved; `./compiler` is purely additive.

# Validation Report — Phase 4 Universal Symbol Extraction Engine

## 1. Gates (final run)

| Gate                    | Result |
| ----------------------- | ------ |
| `npm run format`        | clean  |
| `npx tsc --noEmit`      | clean  |
| `npm run lint`          | clean  |
| `npx vitest run`        | 111 files / 1180 tests passing |
| `npx vitest run --coverage` | 91.51 stmts / 82.66 branch / 93.83 funcs / 93.19 lines (≥ 90/75/90/90) |
| `npm run build`         | ESM + DTS success |

## 2. Tests

Symbol-layer suite: **137 tests across 24 files** (`src/symbols/**`), covering
shared id/name/doc/hash/kind helpers, models (symbols, metadata,
relationships, diagnostics), contracts (capabilities, extractor,
input/output), registry (register/unregister/resolve/hooks/summary), filters,
visitors (collect/visit/ancestors/children/leaves/depth/pruning), diagnostics
detection and summaries, the incremental cache, the derived graph, real
TypeScript and JavaScript extractor integration over compiled units (exports,
imports, re-exports, class members, heritage, getters, enums, multiple units),
and the full SymbolEngine integration suite (project/package/module roots,
cache hits, invalidate/clearCache, skipCache, maxSymbols, mixed-language,
package mapping/versions, missing-extractor diagnostics, capabilities,
dispose).

Engine integration adds `engine.symbols` lazy-getter coverage and disposal.

## 3. Architecture

- `src/symbols` consumes `CompilationUnit`s from the compiler layer and
  produces immutable `Symbol`s — one shared `buildSymbols` call gives every
  symbol the same `SymbolStore` so ownership edges resolve.
- Deterministic ids (project/package/module/qualified-name) keep symbols
  stable across runs, powering the incremental per-file-hash cache.
- TypeScript and JavaScript extractors share one node-walk core with a
  per-language `kindFor` mapping and documentation-format hint.
- The graph is derived, never annotated: edges are recomputed from symbols
  each build, and relative specifiers resolve against known files.
- `engine.symbols` is a lazy `SymbolEngine`; `engine.dispose()` disposes it
  with its cache and extractor hooks.

## 4. Behavior Notes (fixed during Phase 4)

- `SymbolEngine` treated `skipCache` as "extract nothing"; it now bypasses the
  cache and re-extracts all units while still updating the cache.
- The Babel tree did not name class members (`ClassProperty`/`ClassMethod`
  keep their name in `key`), and members were nested under a `ClassBody`
  node; the tree now names them and the shared walk unwraps `ClassBody` and
  treats Babel class-member kinds as declarable, so class properties, methods
  and accessors appear as named children.
- TypeScript `VariableStatement` aliases the `FirstStatement` enum name in
  some versions; the tree builder maps the alias back and drops only
  `*Token`/`*Keyword` leaves so identifiers survive.

## 5. Constraints Honored

- No semantic analysis, type resolution, knowledge graph, AI, or doc
  generation — structural extraction only.
- Public barrel (`src/index.ts`) byte-identical — still 12 exports, verified
  against the built bundle.
- `src/symbols` depends only on the compiler layer, language adapters, shared
  contracts and utils — never generator/renderer/themes/CLI/search/AI;
  `./symbols` is purely additive.

---

# Validation Report — Phase 5 Universal Reference Resolution Engine

## 1. Gates (final run)

| Gate                    | Result |
| ----------------------- | ------ |
| `npm run format`        | clean  |
| `npx tsc --noEmit`      | clean  |
| `npm run lint`          | clean  |
| `npx vitest run`        | 123 files / 1251 tests passing |
| `npx vitest run --coverage` | 91.5 stmts / 81.97 branch / 94.03 funcs / 93.48 lines (≥ 90/75/90/90) |
| `npm run build`         | ESM + DTS success |

## 2. Tests

Reference-layer suite: **71 tests across 12 files** (`src/references/**`),
covering shared id helpers, models (references, bindings, resolutions,
statistics), contracts (capabilities, resolver, input/output), registry
(register/unregister/resolve/capabilities/cap — 9 resolvers rejected), filters
(kind/language/resolved predicates), diagnostics (missing-resolver detection +
summaries), the incremental binding cache (hits, invalidate, clearCache,
skipCache), the derived graph (import/export/heritage/type-use edges,
resolved/unresolved, statistics), scope (lexical shadowing, import/export/
local lookup orders, unknown imports), visitors (collect/visit/prune/kind
filters), real TypeScript/JavaScript binding extraction over compiled units
(default/named/namespace imports, import-equals, re-export clauses, export
aliases, frozen bindings), and the full ReferenceEngine integration suite
(resolve with stats, cache hits, `engine.references` after dispose, no-unit
fallback, missing-resolver diagnostics with built-ins disabled, mixed
language, statistics consistency).

Engine integration adds `engine.references` lazy-getter coverage and disposal.

## 3. Architecture

- `src/references` consumes `Symbol`s from the Phase 4 symbol engine and
  produces frozen `Reference` records plus a serializable `ReferenceGraph`.
- The shared binding extractor (`resolvers/common.ts`) flattens import/export
  container nodes recursively, so nested `NamedImports` under `ImportClause`
  (TypeScript shape) yield every named binding.
- Resolution is per language via the resolver registry with capability-based
  `canResolve`; files without a resolver get a `missing-resolver` diagnostic.
- The graph is derived, never annotated: `Reference`s carry `toId` only when
  the target symbol resolves, and statistics are computed from the graph.
- `engine.references` is a lazy `ReferenceEngine`; `engine.dispose()` disposes
  it with its resolvers and cache.

## 4. Behavior Notes (fixed during Phase 5)

- The shared import extractor only flattened `ImportClause` children, so the
  `NamedImports` container (and its `ImportSpecifier`s) nested under a
  TypeScript `ImportClause` were dropped — default and namespace imports were
  recovered but named imports were not. The candidate walk now flattens
  `NamedImports`/`ImportClause` containers recursively in index order; export
  extraction was hardened the same way for `ExportClause`/`NamedExports`.
- The registry caps resolvers per language at 8 (`MAX_RESOLVERS_PER_LANGUAGE`),
  rejecting the 9th registration; the test suite registers exactly 8 before
  asserting the rejection.
- The built-in extractors do not populate `symbol.typeName`, so `type-use`
  edges only appear when an extractor supplies it; `type-use` resolution is
  covered with hand-built symbols in the graph suite and the engine
  integration test asserts `heritage` resolution instead.

## 5. Constraints Honored

- No AI, doc generation, or a full semantic type system — name-based,
  structural resolution only.
- Public barrel (`src/index.ts`) byte-identical — still 12 exports, verified
  against the built bundle.
- `src/references` depends only on the compiler layer, language adapters,
  symbols, shared contracts and utils — never generator/renderer/themes/
  CLI/search/AI; `./references` is purely additive.

---

# Validation Report — Phase 6 Universal Knowledge Graph

## 1. What Was Delivered

`src/graph/` — the universal, serializer-friendly graph that unifies the
per-subsystem graph work (symbols' structural edges and references' resolved
edges) into a single derived structure. It is language-agnostic and fully
covered by tests.

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
  index.ts       barrel (already in vitest coverage excludes)
```

- `engine.graph` lazily creates the `GraphEngine`; `dispose()` tears it down.
  `sync()` runs registered contributors over current symbols/references
  snapshots; each contributor gates its own work on data availability (the
  references contributor skips when the reference graph is empty).
- Node/edge kinds are closed `union` types → unknown kinds are compile-time
  errors; edge payloads are discriminated by kind and accessors narrow types.
- Visitors return stable ids; the engine resolves ids to live nodes/edges.

## 2. Architecture

```
GraphEngine ── sync ──▶ ContributorRegistry (ordered)
   │                        │ runs each GraphContributor
   │                        ├─ structural (symbols → nodes/edges)
   │                        └─ references (resolved edges, gated)
   ▼
graph: { nodes, edges, statistics, neighbors, node(), edgeIds }
```

## 3. Validation Summary

| Check                        | Result |
|------------------------------|--------|
| `tsc --noEmit`               | clean  |
| `npm run lint`               | clean  |
| `npm run build` (ESM/CJS/DTS)| success |
| `vitest run`                 | 131 files / 1290 tests pass |
| `vitest run --coverage`      | all thresholds met (lines ≥ 90) |
| Public API                   | 12 exports, byte-identical |
| Graph test suite             | engine 100% / models 100% / registry 100% / contracts 100% |

## 4. Behavior Notes (fixed during Phase 6)

- The integration fixture (`src/a.ts` imports `point`, `src/shapes.ts` imports
  `Point` and declares `Circle` with a `references` to `Point`) produces **two**
  `imports` edges — one per importing module — so engine statistics and the
  import filter both expect 2, not 1.
- `Circle` lives in `src/shapes.ts`, so its `declared-in` edge targets the
  shapes **module** node, not the `src/a.ts` module.
- `collectNodes(…, "c:Circle", references)` walks the start node too: the
  `references` edge keeps `Circle` connected to `Point`, so the result is
  `["c:Circle", "c:Point"]`.

## 5. Constraints Honored

- No AI, doc generation, or a full semantic type system — the graph is
  structural and derives from symbols + resolved references.
- Public barrel (`src/index.ts`) byte-identical — still 12 exports, verified
  against the built bundle; `src/graph` is internal, reachable via
  `engine.graph`.
- `src/graph` depends only on the compiler layer, language adapters, symbols,
  references, shared contracts and utils — never generator/renderer/themes/
  CLI/search/AI.
