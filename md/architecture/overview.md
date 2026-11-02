# Architecture Overview

End-to-end flow of the default build, verified against the shipped bundle:

```text
authored *.md/*.mdx + assets
  → content discovery + normalization
  → canonical site model (home, sections, blog, nav, search)
  → Documentation IR adapter (schemaVersion 1, provenance "user")
  → output planning (routes, paths, home)
  → Fumadocs / static / Markdown / Next.js renderers
  → owned writers → manifest.json → search index → reconcile → validate
```

The CLI resolves root/config/logger once per command, the engine (`createDocsEngine` → `initialize` → `build` → `dispose`) orchestrates discovery, legacy pipeline stages, and materialization, and every write is root-bounded and manifest-tracked. Details: [Content Pipeline](content-pipeline.md), [Renderers](renderers.md), [Filesystem Safety](filesystem-safety.md), [Testing](testing.md).
