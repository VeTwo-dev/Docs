# Key Concepts

The six ideas behind every page in this corpus.

## 1. Authored content is the source of truth

The generator renders what you write. `docs/index.md` plus your guides and posts *are* the documentation. If content is missing, the build fails loudly instead of inventing pages, titles, dates, or API entries. See [Authored Source of Truth](../concepts/authored-source-truth.md).

## 2. Content discovery

The generator finds `*.md`/`*.mdx` under the configured `source` directory in deterministic order, skipping tooling directories (`node_modules`, `dist`, `build`, `.git`, `coverage`, `.vetwo`, `generated/`). See [Content Discovery](../concepts/content-discovery.md).

## 3. Canonical site model

Discovered files are normalized (frontmatter, headings, links, assets) into one site model: exactly one home page, sections from directories, dated blog posts with a synthesized `/blog` listing, one navigation tree, and search records. See [Normalization](../concepts/normalization.md) and [Site Model and Navigation](../concepts/site-model-navigation.md).

## 4. Intermediate representation (IR)

The site model is adapted into a versioned Documentation IR (`schemaVersion: 1`) — pages with blocks, empty inference fields, link references, and `provenance: "user"`. Renderers consume the IR, never source analysis.

## 5. Renderers and output plans

An output plan derives per-target routes, file paths, navigation, and the home page from the IR. Targets: Fumadocs/Next.js project (`site/`), static HTML (`static/`), plain Markdown/MDX (`md/`), Next.js app (`next/`), plus deterministic `generated/*.mdx` artifacts. See [Rendering and Targets](../concepts/rendering-targets.md).

## 6. Generated-file ownership

Every written file is inventoried in `manifest.json` (marked `_generatedBy: "@vetwo/docs"`) or carries a `generator: "@vetwo/docs"` marker. Rebuilds refresh owned files, remove provably-stale ones, and always preserve user-owned and unknown files. See [Ownership and Reconciliation](../concepts/ownership-reconciliation.md).
