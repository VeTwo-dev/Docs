# Architecture

`@vetwo/docs` is a Markdown/MDX-first documentation-site generator. Authored content flows through one canonical pipeline into two supported site targets. A retained legacy inference stack stays available as an opt-in compatibility path (see [COMPATIBILITY.md](COMPATIBILITY.md)) but participates in neither the default flow nor the architecture below unless explicitly selected.

## The canonical pipeline

```
authored *.md/*.mdx + assets
  → content discovery + normalization   (src/site/discovery.ts, src/site/normalize.ts)
  → canonical site model                (src/site/model.ts)
  → Documentation IR (adapter)          (src/site/adapters.ts)
  → output planning                     (src/renderers/output-plan.ts)
  → target renderers                    (src/renderers/{fumadocs,static,markdown,nextjs}/)
  → owned reconciliation                (src/renderers/writer.ts, manifest.json)
```

- **Discovery** finds `*.md`/`*.mdx` under the configured `source` root, deterministically ordered, ignoring `node_modules`, `dist`, `build`, `.git`, `coverage`, `.vetwo`, and the `generated/` directory. No source-code scanning participates.
- **Normalization** parses frontmatter and structure per file. Title: frontmatter `title` → first H1 → filename. Description: frontmatter `description` → first paragraph as plain text (max 160 chars). `order`: numeric frontmatter/`sidebar.order`, default `0`. `date`: strict `YYYY-MM-DD` literal only — impossible dates are rejected, never coerced. `author`: non-empty string passthrough. `kind`: `documentation` (default), `blog` (under the `blog/` directory), or `home` (reserved for the root `index.md`; exactly one home page).
- **Site model** assigns routes (`index.md` → `/`, `guide/start.md` → `/guide/start`), builds sections from top-level directories, orders blog posts newest-first, synthesizes a `/blog` listing page when posts exist (unless the author claims `/blog`), and builds navigation, search records, and the asset inventory. Duplicate routes fail loudly.
- **IR adapter** reshapes the model into the versioned Documentation IR (`schemaVersion: 1`; pages carry `blocks`, empty `examples`/`claims`, link `references`, and `provenance: "user"`) without inference.
- **Output planning** derives per-target routes, file paths, navigation, and the home slug (first nav page, else first page) from the IR.
- **Renderers** consume the plan: Fumadocs/Next.js project (`site/`), portable static HTML (`static/`), plain Markdown/MDX pages (`md/`), and a Next.js app (`next/`), plus deterministic `generated/*.mdx` artifacts in canonical mode carrying `generator: "@vetwo/docs"` ownership markers.
- **Reconciliation** writes through ownership-checked writers, inventories every file in `manifest.json` (`_generatedBy: "@vetwo/docs"`), and on the next build removes only provably-owned stale files. User-owned and unknown files are preserved; see [SAFETY.md](SAFETY.md).

## Engine and CLI lifecycle

```
CLI (src/cli/, commander)
  → DocsEngine (src/engine/: createDocsEngine → initialize → build → dispose)
    → legacy pipeline stages (discovery, feature generators)   [see COMPATIBILITY.md]
    → materializeDocumentation (src/engine/docs-materialize.ts)
      → renderers → writers → manifest → search index → reconcile → validate
```

`initialize()` detects the project and loads configuration (idempotent; `rootDir` falls back to `process.cwd()`). `build()` resolves everything against the project root. All nine top-level CLI commands share one context helper (logger + root + optional config); see [CLI.md](CLI.md).

## Key modules

| Module | Responsibility |
|---|---|
| `src/site/` | Canonical content pipeline: discovery, normalization, site model, IR adapter, MDX serialization |
| `src/renderers/` | Output planning, target renderers (Fumadocs, static, Markdown, Next.js), shared writer, design tokens |
| `src/engine/` | `DocsEngine` lifecycle, service container, materialization orchestration |
| `src/documentation/compiler/` | Legacy inference pipeline and IR (opt-in; also defines shared IR/manifest types) |
| `src/config/` | Loading, Zod validation (no defaults), and `defineDocs` normalization (single defaults boundary, frozen output) |
| `src/scanner/` | File discovery and project detection |
| `src/content/` | Authored-content inspection, MDX parsing, regeneration planning |
| `src/state/` | Namespaced engine state under `.vetwo/docs/` with retention classes |
| `src/init/` | Plan/apply workspace bootstrap with ownership classification |
| `src/dev-server/` | Development server with live reload |
| `src/api/`, `src/intelligence/`, `src/ai/`, `src/incremental/`, `src/integrations/` | Retained legacy/intelligence tooling (opt-in; see [COMPATIBILITY.md](COMPATIBILITY.md)) |
| `src/filesystem/`, `src/errors/`, `src/logger/`, `src/cache/` | Shared infrastructure, including the authoritative path-containment check |

**Dependency rule:** content flows downward (CLI → engine → site model → renderers → filesystem). Renderers consume the IR and plan; they never invoke analysis.

## State

All engine runtime state lives under `.vetwo/docs/` in registered namespaces with retention classes (`cache`, `temporary`, `persistent`, `generated`); only registered namespaces are ever cleaned, and manifests plus user-owned state are excluded. Generated documentation output lives separately under the configured output directory (default `./docs/`), tracked by `manifest.json`.

## Design tokens and presentation

Both site targets share one token module (`src/renderers/tokens.ts`); each target emits its own CSS from those tokens, so visual identity stays consistent without a shared runtime.
