# Normalization

What happens to one file between discovery and the site model. Pure function of the file's own frontmatter and structure — no cross-file inference.

## Title, description, order

- `title`: frontmatter `title` → first H1 → filename (`getting-started` → `Getting Started`; a bare `index.md` falls back to its directory name, or `Home` at root).
- `description`: frontmatter `description` → first paragraph stripped to plain text (max 160 chars) → empty string.
- `order`: numeric `order` (or `sidebar.order`) → `0`.

## Dates, authors, kinds

- `date`: the author's literal `YYYY-MM-DD` scalar only. YAML timestamp coercion overflows impossible dates before validation could see them, so the literal is re-extracted from the frontmatter fence; anything invalid yields no date rather than an invented one.
- `author`: non-empty string passthrough, never invented or coerced.
- `kind`: `documentation` by default; `blog` for files under the blog directory (default `blog/`); `home` reserved for the root index (exactly one). An explicit `kind: documentation|blog` frontmatter override wins, except `home` which additionally requires the root index file.

## Headings, links, assets

Headings get GitHub-style slugs; Markdown links become canonical link records (internal targets resolve against known pages, unknowns are kept as written); images become asset records resolved against the project root. Search text derives from blocks (capped), and word count/reading time are computed from the body.
