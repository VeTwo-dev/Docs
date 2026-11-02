# Self-Hosting This Documentation

This project documents itself with the same public pipeline it ships. The authored corpus under `md/` is the single source of truth; everything under `docs/` and `docs-static/` is generated from it. There is no hand-written website and no second Markdown engine.

## Source of truth

- One `.md` file is one page. Routes derive from file paths: `md/guides/deployment.md` → `/guides/deployment`, `md/cli/index.md` → `/cli`.
- Pages carry a single H1 (the title) and relative Markdown links. No frontmatter is used.
- `md/` is hand-authored and is **never** overwritten by the generator; only `docs/` and `docs-static/` are generator-owned.

## Configuration

| File | Purpose | Output |
|---|---|---|
| `docs.config.ts` | Full workspace (canonical pipeline) | `docs/` — Markdown (`md/`), static HTML (`static/`), and a Fumadocs + Next.js app (`site/`) |
| `docs.static.config.ts` | Portable static site only | `docs-static/static/` — static HTML (plus the workspace manifest) |

Both configs set `source: "./md"` and `content: { pipeline: "canonical" }`, so Markdown, static HTML, and Fumadocs all materialize from the same corpus. In canonical mode the legacy feature pipeline (flat, source-code-derived HTML at the output root) is skipped; `materializeDocumentation` owns all output.

## Developer workflow

```bash
pnpm install            # install the CLI/library toolchain
pnpm docs:generate      # build the CLI, then render ./md → docs/
pnpm docs:install       # one-time: install deps for the generated docs/site app
pnpm docs:dev           # generate, then serve the Next.js/Fumadocs dev site
pnpm docs:build         # generate, then production-build the Fumadocs site
pnpm docs:static:build  # render ./md → docs-static/ (portable static HTML)
pnpm docs:verify        # validate generated pages, routes, and links
```

`docs:generate` runs `pnpm build` (the library's `tsup` bundles) first because the CLI is invoked from `dist/`. The `docs:dev` and `docs:build` scripts then hand off to the generated Fumadocs app in `docs/site/`.

## Where output lives

- `docs/md/**/*.md` — canonical Markdown pages rendered from `md/`.
- `docs/static/**/*.html` — portable static HTML (site root at `docs/static/index.html`).
- `docs/site/**` — a real Fumadocs + Next.js application (`app/`, `content/docs/`, `next.config.mjs`, `package.json`, …).
- `docs/site/out/**` — the exported production site produced by `docs:build` (`output: "export"`).
- `docs-static/static/**/*.html` — the static-only site produced by `docs:static:build` (site root at `docs-static/static/index.html`).

Both `docs/` and `docs-static/` are gitignored: the generator owns them and they are safe to delete and regenerate.

## Adding or editing a page

1. Create or edit a `.md` file under `md/` (one H1, relative links).
2. Run `pnpm docs:generate` (and `pnpm docs:static:build` for the static-only target).
3. The new page appears in navigation, the sitemap, and search with no other changes.

Renaming or removing a source page removes its generated counterpart on the next build; the generator reconciles its own output rather than accumulating stale files.

## Verification

`pnpm docs:verify` runs the CLI's `validate-output` command against the generated workspace and reports the page, route, and asset counts. A non-zero exit means a generated link or route is broken.

The committed regression test `src/site/self-hosting.test.ts` exercises the same `md/` corpus through discovery, the site model, the Documentation IR, and both the static and Fumadocs renderers.

## Limitations and notes

- Framework dependencies (Next.js, Fumadocs, Tailwind, graphology/sigma) live only in the generated `docs/site/package.json`; they are never dependencies of the CLI or engine.
- `docs:build` passes `--webpack` to `next build`. Turbopack's default production build in Next 16 can exceed memory on small machines; the webpack path is the reliable static export here. The generated `next.config.mjs` also enables `experimental.webpackMemoryOptimizations` to lower peak memory.
- OG image generation is best-effort: without the optional `takumi`/`sigma` dependencies the build logs `failed to generate OG image` warnings but still succeeds.
