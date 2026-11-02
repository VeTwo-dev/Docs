# What Is @vetwo/docs?

`@vetwo/docs` (`1.0.0`, Node.js 20+, MIT) is a documentation-site generator for JavaScript and TypeScript projects. You author Markdown/MDX; it produces sites.

## Intended audience

- Maintainers who want docs generated from content they write and control.
- Teams publishing a Fumadocs/Next.js site or a portable static site from one model.
- Contributors extending the generator via plugins, themes, or React components.

## Supported workflows

- Content-first generation (default): authored `*.md`/`*.mdx` → canonical site model → renderers → owned output.
- Next.js + Fumadocs project output and dependency-free static HTML output.
- Blog posts with dates, build-time search, navigation, sitemap-style artifacts.
- Safe regeneration: manifest-tracked ownership, stale-output cleanup, user files never overwritten.
- Legacy opt-in: TypeScript API inference via `content.pipeline: "legacy"` and the `analyze`/`plan`/`render` tooling.

## Explicit non-goals

- Not a general source-code intelligence, compiler-analysis, dependency-graph, or API-analysis platform.
- Not a CMS: there is no hosted editing, preview service, or content database.
- Not an AI documentation generator: AI provider tooling exists as legacy-compatible surface only and runs nothing by default.
- Generated scaffolds are starting points the package does not keep building, hosting, or deploying for you.

## Where to go next

- [Key Concepts](key-concepts.md) for the mental model.
- [Choose a Workflow](choose-a-workflow.md) to pick a path.
- [Quick Start](quick-start.md) for the shortest working path.
