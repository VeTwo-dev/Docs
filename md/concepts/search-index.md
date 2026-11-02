# Search Index

How search is built and how it behaves at runtime. Two layers: a workspace-level index artifact plus per-target search experiences.

## Build time

Every build writes the root `search-index.json`: one entry per page (`id`, `title`, `content`, `url`, `category`), plus the configured `engine` name and a generator marker. Canonical mode feeds it from the site model's search records (honoring `search: false` opt-outs); the records also ship as `static/search/search.json` and through the Fumadocs search route.

## Configuration

```js
search: {
  enabled: true,
  engine: "minisearch",   // or "pagefind"
  indexFields: ["title", "content", "category"],
  maxResults: 20,
}
```

## Runtime (static target, verified live)

Vanilla JS, no dependencies, no server: fetch the sibling `search.json`, rank title above description above content, show the top 20 with text-only DOM updates, honor an initial `?q=` parameter. Needs HTTP(S) — `fetch` does not load the records from `file://`.
