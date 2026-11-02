# Static HTML Output

The secondary target: dependency-free HTML/CSS/JS under `<output>/static/`, verified live during documentation writing.

## Enabling it

```js
export default defineDocs({
  source: "./docs",
  output: {
    directory: "./out",
    layout: { markdown: true, static: true },
  },
});
```

Run `npx docs build`, then serve the directory with any static server (`npx docs serve`, `python3 -m http.server`, nginx, or a CDN).

## Layout

- `index.html` — the home page (also emitted per-page at `<slug>/index.html`).
- `assets/css/globals.css` — shared design tokens compiled to CSS.
- `search/index.html` + `search/search.json` — self-contained search UI plus records.
- `assets/` — copied image bytes for referenced assets that exist.

## Links and portability

- Navigation, breadcrumbs, and brand links are plan-relative (`../guide/start/` style), so pages work from any base path.
- Authored root-absolute routes (`/guide/start`) are relativized when they match planned pages, with `?query`/`#hash` preserved.
- External URLs, anchors, relative asset paths, and unknown absolute routes pass through verbatim.
- If user content claims `/search`, the synthesized search UI is skipped and the user's page renders normally.

## Search behavior

The search page is vanilla JS (no dependencies, no server): it fetches the sibling `search.json`, ranks title above description above content, renders the top 20 with text-only DOM updates, and honors an initial `?q=` parameter. Result links use the relative `url` field; the canonical `route` field in records is metadata. Serve over HTTP(S) — `fetch` does not load the records from `file://`.

## When to choose static over Fumadocs

Choose static for docs that must work without Node.js at serve time, offline bundles, or embedding inside another site. Choose Fumadocs when you want the Next.js ecosystem (layouts, MDX components, API routes). Both render from the same IR, so content stays identical.
