# Site Model and Navigation

How normalized documents become one site: home, sections, blog, navigation, and search records.

## Home

Exactly one home page: the `home`-kind document at route `/`. The output plan falls back deterministically without one (first navigation page, else first page — the Fumadocs root redirects, the static root aliases `index.html`), but a missing entry point fails validation.

## Sections and pages

Top-level directories become sections; pages sort by `order`, then title, then route. Duplicate routes throw (`Duplicate route "…"`) — two files never claim one URL.

## Blog

Files under the blog directory (default `blog/`) become posts ordered newest-first by valid `date`. A `/blog` listing page is synthesized from post metadata (title, route, date, author, description — no invented copy) unless you author `/blog` yourself, in which case yours wins. The listing is always searchable. Posts without dates still render; they sort after dated ones.

## Navigation

One tree built from home, sections, pages, blog, and listing: sidebar with labeled groups plus breadcrumbs per page. Explicit `nav`/`sidebar` config overrides the derived tree where provided. Search exclusion is per-page (`search: false` frontmatter); everything else is indexed.

Related: [Rendering and Targets](rendering-targets.md), [Customizing the Site](../guides/customizing-the-site.md).
