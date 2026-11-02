# First Documentation Project

Build a small but complete project: home page, guide with a link, and a dated blog post — then inspect every output the default workflow produces.

## Layout

```text
proj/
  package.json
  docs.config.mjs
  docs/
    index.md
    guide/start.md
    blog/hello.md
```

`package.json` needs only a name (identity feeds site metadata). `docs.config.mjs`:

```js
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "Demo",
  description: "Demo docs",
  source: "./docs",
  output: {
    directory: "./out",
    layout: { next: false, markdown: true, static: true, site: false },
  },
});
```

Content:

```md
<!-- docs/index.md -->
# Welcome

Home body.
```

```md
<!-- docs/guide/start.md -->
---
title: Start
---

# Start

See [home](../index.md).
```

```md
<!-- docs/blog/hello.md -->
---
date: 2026-02-01
---

# Hello

First post.
```

## Build and inspect

Run `npx docs build` from `proj/`. This exact fixture was executed while writing these docs. Expected result:

- `out/manifest.json`: `pages` are exactly `index`, `guide/start`, `blog`, `blog/hello` (the `blog` listing is synthesized because a post exists), `_generatedBy` is `"@vetwo/docs"`.
- `out/static/index.html`: the home page; `out/static/blog/hello/index.html`: the post.
- `out/static/search/`: `search.json` records plus a self-contained search page.
- `out/md/*.mdx`: one artifact per page (the `.mdx` extension is the default; set `markdown.extension: ".md"` for plain Markdown).
- `out/generated/*.mdx`: canonical MDX artifacts carrying `generator: "@vetwo/docs"` markers.

Notes from the real run: author-relative links such as `[home](../index.md)` are resolved against the page's source directory and rewritten for each target — relative URLs in static HTML, site routes in Next.js, and document-relative paths in Markdown output. Root-absolute routes (e.g. `/guide/start`) are resolved too when they name a known page. A build with zero discoverable pages fails loudly (`Static: index.html missing`) instead of emitting an empty site.

## Next steps

- [Markdown Content](../guides/markdown-content.md) for authoring rules.
- [Static HTML Output](../guides/static-html-output.md) for serving and search behavior.
- [Configuration](../configuration/index.md) for every option.
