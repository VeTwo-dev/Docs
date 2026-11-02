# Ownership and Reconciliation

How the generator shares a directory with your files without ever harming them.

## Ownership proof

A file is generator-owned when the current `manifest.json` inventories it under its target bucket (and the manifest carries `_generatedBy: "@vetwo/docs"`), or when its content carries the ownership marker (`generator: "@vetwo/docs"` frontmatter in Markdown/MDX, generator header comment in code files). Either proof suffices — even marker-less files from a previous manifest are recognized.

## Reconciliation rules

- **Write**: renderer output lands only inside its own root; per-file containment rejects escapes.
- **Refresh**: owned files are rewritten every build, even if you hand-edited them (don't — fix sources instead).
- **Remove**: files the previous manifest proves owned, but the current build no longer generates, are deleted. Header-marked orphans no inventory claims are swept.
- **Preserve**: unknown files, user-owned files, and anything outside the five target roots are never touched. Malformed or foreign manifests disable reconciliation rather than authorizing deletions.

## Manifest shape

`manifest.json` holds page/route listings plus `files: { next, md, static, site, generated }` inventories. The root `search-index.json` (page entries with title/content/url/category) is rewritten deterministically each build; per-target search artifacts (`static/search/`, Fumadocs search route) derive from the same records.

Related: [Safe `clean` behavior](../cli/clean.md), [Migrating Existing Content](../guides/migrating-existing-content.md).
