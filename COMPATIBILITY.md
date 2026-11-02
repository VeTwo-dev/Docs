# Compatibility and Legacy Behavior

`@vetwo/docs` 1.0.0 is a Markdown/MDX-first generator. Its default workflow (`content.pipeline: "canonical"`, the default in `defineDocs`) renders **authored content only** and performs no source-code analysis. Alongside it, the package retains a set of legacy inference/intelligence interfaces as supported compatibility surfaces. This page inventories exactly what is retained, what it does, and what remains undecided.

## Canonical vs legacy at a glance

| | Canonical (default) | Legacy (opt-in) |
|---|---|---|
| Source of truth | Authored `*.md`/`*.mdx` + frontmatter | TypeScript sources, JSDoc, project signals |
| Selection | `content: { pipeline: "canonical" }` (default) | `content: { pipeline: "legacy" }` |
| Analysis | None — no API analyzers, graph builders, or example synthesizers run | Project knowledge, API symbols, dependency classification, framework detection, integration planning |
| Missing content | Fails loudly (no invented pages, titles, or dates) | May infer pages from code |
| Targets | Next.js, Markdown, static, Fumadocs site, generated MDX | Same renderers, IR built by inference |

The repository's own documentation (`docs.config.ts`) intentionally uses the legacy pipeline because it is API-reference material generated from TypeScript sources — the supported legacy use case.

## Retained public surfaces

These are **supported and will keep working in 1.x**. Do not treat them as removed:

**Package subpaths:** `./api`, `./intelligence`, `./ai`, `./incremental`, `./documentation-compiler`, `./documentation-relations`, `./examples`, `./languages` (plus the content-neutral `./cli`, `./config`, `./plugins`, `./react`, `./renderers`, `./content`, `./state`, `.`).

**Root exports:** the `intelligence`, `documentationRelations`, `examples`, and `state` namespaces; `openApi`/`mermaid` plugins; `discoverSourceFiles`, `detectProject`, hooks, and the engine (`build`, `createDocsEngine`, `DocsEngine`).

**CLI:** `plan`, `analyze`, `coverage`, `render`, `validate-output`, `diff` (inference and architecture tooling); `content check|lint|validate|conflicts|diff`; `changes|impact|update` (incremental); `ai *`; `integrations *`. These commands always use analysis explicitly — invoking them never changes the default pipeline.

**Configuration:** `content.pipeline: "legacy"` plus the `api.*` (enabled/source/include/exclude/readme), `architecture.*` (sections/excludePages), and `ai.*` (enabled/providers/fallbackChain/…) keys. They are inert under the canonical default except where a legacy command reads them.

## Using the legacy pipeline

```ts
// docs.config.ts — TypeScript-first project, API reference wanted
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Library",
  source: "./src",
  output: { directory: "./docs", layout: { next: true, markdown: true, static: true } },
  content: { pipeline: "legacy" },
  api: { enabled: true, source: "./src", include: ["src/**/*.ts"] },
});
```

The legacy end-to-end path (inference → renderers → manifest → validation) is covered by dedicated tests and by the repository's self-documentation build.

## Known architectural limitation: duplicate build work

`engine.build` currently runs the legacy pipeline stages (discovery, feature generators writing `search.html`/`search.js`/`styles.css`/`robots.txt`/sitemap-style artifacts) **and then** canonical materialization. Both write into the same output root deterministically; all writes are root-bounded and reconciled-or-overwritten, so this is redundant work rather than a correctness or safety defect. Unifying the two paths is intentionally deferred — it changes legacy-path behavior and belongs with the decision below, not with day-to-day use.

## Undecided: future major-version removal

Whether the legacy/intelligence surface listed above is removed in a future major release is **explicitly undecided**. This documentation does not promise removal, deprecate these interfaces, or bump the version. A removal decision would need its own migration plan; until then, treat every listed surface as supported.

## What the product is not

Regardless of retained interfaces, `@vetwo/docs` is not a general-purpose source-code intelligence engine, API analyzer, CMS, or AI documentation generator. Those capabilities exist only as the opt-in legacy tooling described here. The supported product is: authored Markdown/MDX in, documentation sites out.
