# Markdown Content

How to author pages the default pipeline renders. Rules verified against the normalizer implementation.

## File placement and routes

- Put `*.md` files under the configured `source` directory (commonly `./docs`).
- Route derivation: `index.md` → `/`, `guide/start.md` → `/guide/start`, `guide/index.md` → `/guide`. The extension is stripped; a trailing `/index` collapses.
- Exactly one home page: the root `index.md` (route `/`). A single page also becomes the home page automatically; zero pages fails the build.
- Duplicate routes fail loudly: `guide.md` and `guide/index.md` (or `a.md` and `a.mdx`) cannot coexist.

## Frontmatter

```yaml
---
title: Start            # default: first H1, else filename
description: A short lede  # default: first paragraph as plain text (160 chars)
order: 1                # numeric section ordering (default 0)
date: 2026-02-01        # strict YYYY-MM-DD; impossible dates are rejected
author: Jane Doe        # non-empty string passthrough
search: false           # opt this page out of the search index
---
```

`kind` override: `documentation` (default), `blog` (or place the file under the `blog/` directory), `home` (reserved for the root index only).

## Body markup

Headings, paragraphs, fenced code blocks (```ts etc.), lists, tables, blockquotes, images (Markdown image syntax — resolved against the project root and copied into output asset dirs), and inline code spans all pass through. Inline code stays literal (never wrapped or reinterpreted). `{@link Target}` directives render as code spans, not links.

## Links

- Author-relative `.md`/`.mdx` links (`../index.md`) resolve against the page's source directory and rewrite per target: relative URLs in static HTML, site routes in Next.js/Fumadocs, and document-relative paths in Markdown output.
- Root-absolute documentation routes (`/guide/start`) resolve too, whenever they name a known page; unknown routes are left as written.
- Fragment links keep their anchor: `advanced.md#details` renders as `advanced/#details` (static) or `/guide/advanced#details` (Next.js). Every rendered heading carries a `github-slugger` anchor, so the fragment resolves in every target.
- Same-page `#anchors`, external URLs, and asset-relative paths pass through untouched.
