# Choose a Workflow

Pick the path that matches your starting point. All paths use the same commands; only the content source and output targets differ.

## New project, docs from scratch

Use `docs init`, write Markdown under the scaffolded source directory, run `docs build`. Follow [Quick Start](quick-start.md), then [First Documentation Project](first-documentation-project.md).

## Existing Markdown collection

Point `source` at your content directory (it does not need to be called `docs/`), run `docs build` with a layout that writes beside — not inside — your sources, and reconcile ownership over a few runs. See [Migrating Existing Content](../guides/migrating-existing-content.md).

## Next.js + Fumadocs output

Enable the `site` layout. The generator emits a complete Fumadocs project (own `package.json` with pinned `fumadocs-*`, `next`, `react`, `tailwindcss` dependencies) that you install, build, and deploy yourself. See [Next.js + Fumadocs Output](../guides/nextjs-fumadocs-output.md).

## Portable static HTML

Enable the `static` layout. The output is dependency-free HTML/CSS/JS with relative links and a self-contained search page — hostable anywhere without a server framework. See [Static HTML Output](../guides/static-html-output.md).

## TypeScript API reference

Only when you explicitly want inference: set `content: { pipeline: "legacy" }` with `api.enabled`, or use the `analyze`/`plan`/`render` commands directly. This is the supported legacy path, not the default. See [Compatibility](../api/compatibility.md).
