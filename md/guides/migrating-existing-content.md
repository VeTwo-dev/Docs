# Migrating Existing Content

Adopting `@vetwo/docs` for a Markdown/MDX collection you already have. Nothing is rewritten for you; the work is discovery rules, one home page, and config.

## 1. Audit before moving anything

- Identify the current content root and every file that is **documentation** versus, say, changelogs, ADRs, or blog archives. The engine discovers **all** `.md`/`.mdx` below `source`, so co-locating non-docs Markdown means adopting it too (use `ignore` for the rest).
- Check filenames for route collisions: `guide.md` and `guide/index.md` (or `guide.md`/`guide.mdx`) both claim `/guide` and fail the build with `Duplicate route`.
- Confirm each document has a sensible title: frontmatter `title` → H1 → filename, in that order. Many old collections lack H1s and rely on filenames.

## 2. Move content and add exactly one home page

```bash
mv content-guide docs/           # or keep in place and set source accordingly
```

Add a root `docs/index.md` (the `/` home). Without a home the `static` target fails validation; with a single page, that page becomes home automatically.

## 3. Configure

```ts
// docs.config.ts
import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Acme Docs",
  source: "./docs",
  output: "./out", // explicit: keep generated files out of sources
  ignore: ["**/changelog.md", "**/_drafts/**"],
});
```

Precedence is CLI flag → config file → environment → defaults; `source` defaults to `./src` (not `./docs`), which is the usual reason an import finds nothing.

## 4. Dates and Blog

Frontmatter dates must be strict `YYYY-MM-DD` literals. Post-2015 YAML parsers coerce unquoted dates to `Date` objects and overflow the field; quoted strings and in-fence dates are handled. Posts under `blog/` with a valid date are sorted date-descending and, unless you author `blog/index.md` yourself, a `/blog` listing is synthesized for you.

## 5. Build, review, adopt

```bash
npx docs doctor   # config/version/source checks
npx docs build
```

Expect the five target roots (`site/`, `static/`, `md/`, `next/`, `generated/`) plus `manifest.json`. First run is additive: nothing is deleted. Only after you have reviewed the output should you rely on reconciliation, and only for files the manifest proves generator-owned — your previous hand-built site directory is *user-owned* and will be preserved, so retire it yourself.

## Migration checklist

- [ ] Content root chosen; non-doc Markdown either adopted or ignored
- [ ] No filename pair maps to one route
- [ ] Exactly one home page (`index.md`)
- [ ] Explicit `output` outside the content tree (or an `ignore` entry for it)
- [ ] Dates quoted where present
- [ ] `docs doctor` clean, `docs build` succeeds, output reviewed
- [ ] Old site output removed manually, never assumed cleaned