# Glossary

Project-specific terms as the implementation uses them.

- **Authored content**: Markdown/MDX files (plus assets) you write; the only source of truth.
- **Canonical pipeline**: the default discovery → normalization → site model → IR → plan → render flow (`content.pipeline: "canonical"`).
- **Legacy pipeline**: the opt-in inference flow from TypeScript sources (`content.pipeline: "legacy"`).
- **Site model**: the single in-memory representation (home, sections, pages, blog, navigation, search records, assets).
- **IR (Documentation IR)**: versioned (`schemaVersion: 1`) renderer-neutral form of the site model; pages carry blocks and `provenance: "user"`.
- **Output plan**: per-target routes, file paths, navigation, and home derived from the IR.
- **Renderer**: a target emitter (Fumadocs, static, Markdown, Next.js) consuming the plan.
- **Manifest** (`manifest.json`): per-target file inventory plus `_generatedBy: "@vetwo/docs"` ownership proof at the workspace root.
- **Reconciliation**: removal of owned-but-stale files using the previous manifest; unknown files survive.
- **Namespace** (state): a registered engine-state area under `.vetwo/docs/` with a retention class.
- **Owned file**: inventoried in the manifest or carrying a `generator:` marker.
- **User-owned file**: anything else — never modified or deleted by generation or cleanup.
- **Home page**: the root `index.md` (route `/`); exactly one; the static root and Fumadocs root resolve to it.
- **Provenance**: page origin marker; canonical pages are always `"user"`.
