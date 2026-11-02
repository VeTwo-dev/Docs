# Renderers

Responsibilities and differences of the four site renderers plus generated artifacts. All consume the same output plan; differences are contractual per target, never content divergence.

## Fumadocs (`site/`)

Emits a runnable project: manifest with pinned deps, Next/MDX/postcss/TS configs, root layout with Tailwind globals, `[[...slug]]` docs page, search API route, graph page + viewer component, MDX content pages, nav metadata, `graph.json`. Unknown JSX passes through for the Fumadocs MDX pipeline. Home served at `/`; without a literal home document the root redirects to the plan home.

## Static (`static/`)

Dependency-free pages: home aliased at `index.html`, `<slug>/index.html` otherwise, shared token CSS, search UI + records, copied assets. Links are plan-relative with trailing-slash directories; authored absolute routes matching pages are relativized (query/hash kept); everything else passes through. Unknown components become naming comments, never raw JSX.

## Markdown (`md/`)

One `.mdx` (default) or `.md` file per page plus nav metadata. `.md` mode degrades custom blocks deterministically (no JSX leaks). Unknown components pass through in `.mdx` mode.

## Next.js (`next/`)

Data-payload app shape: per-page JSON payloads the app shell serves, with layouts and globals validated (CSS present and imported, every page has a payload, no cross-renderer paths).

## Generated (`generated/`, canonical only)

Deterministic `.mdx` per source document with `generator: "@vetwo/docs"` identity frontmatter — the reconciliation anchor for derived content.
