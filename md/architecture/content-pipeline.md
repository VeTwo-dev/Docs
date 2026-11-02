# Content Pipeline

Stage-by-stage behavior of the default pipeline (see [Concepts](../concepts/authored-source-truth.md) for the user-facing rules).

1. **Discovery** (`discoverContentDocuments`): `**/*.md(x)` under the anchored source root, default ignores plus config, path-sorted. Unreadable files and invalid MDX throw with the path.
2. **Normalization** (`normalizeDocument`): pure per-file function — frontmatter, headings/links/assets via AST, blocks, search text, word count. Title/date/author rules in [Normalization](../concepts/normalization.md); the author's date literal is re-extracted from the fence because YAML coercion overflows.
3. **Site model** (`buildSiteModel`): duplicate-route assertion, home/pages/blog split, date-desc post sort (dated before undated, id fallback), synthesized `/blog` listing, navigation, search set, deduped assets.
4. **IR adapter** (`siteModelToIR`): pages with blocks, empty examples/claims, known-link references, content-hash fingerprints, `provenance: "user"`; blog section appended when posts exist.
5. **Output plan** (`buildOutputPlan`): per-page route/md/static paths, nav order (navigation first, then slug order), `homeSlug` (first existing nav slug, else first page).
6. **Render + reconcile + validate**: each renderer emits into its own root; `writeSiteFiles`/`writeAssetBytes` enforce containment; the manifest inventories; previous-manifest reconciliation removes only owned-stale files; the validation gate throws on errors (missing entry points, absent payloads, leaks, unwired CSS).
