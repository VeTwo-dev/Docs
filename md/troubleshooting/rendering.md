# Rendering Failures

- **`Static: index.html missing`**: no home page reached the static target — add a root `index.md` (or any single page, which becomes home) under `source`.
- **Missing page payload/content errors naming a slug**: the IR page has no corresponding renderer file — indicates a renderer/plan mismatch, not content to fix by hand. Re-run; if it persists, report with the full message.
- **Cross-renderer leak errors** (`content/` inside `next/`, `md/` inside `static/`, …): stale artifacts from an older layout. The reconciler plus the legacy-path migration normally clears them; if they persist, inspect (don't hand-delete generator-owned files — let a clean build reconcile).
- **CSS errors** (`globals.css` missing / layout doesn't import it / not Tailwind-based): the scaffold or stylesheet step didn't complete — rebuild; if custom themes are involved, check `theme.cssOverrides` paths.
- **Search page empty / no records**: no searchable pages (all `search: false`? zero pages?) or a stale `search.json` — rebuild and check `manifest.json` page counts.
- **Fumadocs app won't `npm install`/`build`**: install inside `site/` (its manifest pins its own deps); ensure Node 20+ and network for the registry.
