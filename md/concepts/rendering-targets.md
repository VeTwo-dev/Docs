# Rendering and Targets

How the site model becomes files. The model is adapted to the versioned IR, an output plan derives routes/paths/navigation/home per target, and each renderer emits its tree independently into its own root (`next/`, `md/`, `static/`, `site/`, `generated/`).

## Target contracts

- **Fumadocs (`site/`)**: complete runnable project (own manifest, configs, layouts, search route, MDX content pages, nav metadata). Primary target.
- **Static (`static/`)**: dependency-free pages (`<slug>/index.html`, home aliased at root `index.html`), shared CSS, self-contained search UI + records, copied assets.
- **Markdown (`md/`)**: one `.mdx` (default) or `.md` page per IR page, plus per-target nav metadata.
- **Next.js (`next/`)**: data-payload Next.js app shape (page JSON payloads, layouts, globals).
- **Generated (`generated/`)**: canonical `.mdx` artifacts per source document, ownership-marked (canonical pipeline only).

## Shared semantics, accepted differences

All targets consume the same IR: same slugs, titles, home, blog order, and navigation. Differences are presentational and contractual per target: trailing-slash directory links in static, absolute routes in Fumadocs, degraded custom blocks in plain Markdown, HTML comments for unknown components in static. The validation gate enforces per-target invariants (entry points exist, payloads match pages, no cross-renderer leaks, CSS wired).

All targets share one visual identity: the persistent design sources under `design/` (tokens → base → components) are composed into each target's `globals.css` on every build. See [Design System](design-system.md).

Related: [Next.js + Fumadocs Output](../guides/nextjs-fumadocs-output.md), [Static HTML Output](../guides/static-html-output.md), [Architecture](../architecture/overview.md).
