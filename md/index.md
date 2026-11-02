# @vetwo/docs Documentation

`@vetwo/docs` renders authored Markdown and MDX content into documentation websites. This corpus is the documentation source of truth: every page here is one independently addressable page that a future website generator can discover and render without rewriting.

## Product in one paragraph

Write Markdown/MDX files plus a `docs.config.ts`. Run `docs build`. Get a documentation site: a **Next.js + Fumadocs project** (primary target) and **portable static HTML** (secondary target), with navigation, Blog, search, and safe generated-file ownership. Missing content fails the build — nothing is invented. API reference inferred from TypeScript sources exists only as an explicit opt-in legacy path.

## Primary workflows

- New project, content-first: [Quick Start](getting-started/quick-start.md) → [First Documentation Project](getting-started/first-documentation-project.md)
- Existing Markdown collection: [Migrating Existing Content](guides/migrating-existing-content.md)
- Fumadocs output: [Next.js + Fumadocs Output](guides/nextjs-fumadocs-output.md)
- Portable output: [Static HTML Output](guides/static-html-output.md)
- This project documents itself: [Self-Hosting This Documentation](development/self-hosting.md)
- Something broke: [Troubleshooting](troubleshooting/index.md)

## Navigation map

- [Getting Started](getting-started/quick-start.md): what the package is, key concepts, choosing a workflow, installation, first project.
- [Installation](installation/prerequisites.md): prerequisites, installing, verification, upgrading.
- [Guides](guides/markdown-content.md): authoring Markdown/MDX, outputs, customization, deployment, migration.
- [CLI](cli/index.md): every command, flag, exit code, and environment variable.
- [Configuration](configuration/index.md): files, options, pipeline selection, defaults, examples.
- [Concepts](concepts/authored-source-truth.md): source of truth, discovery, normalization, site model, rendering, ownership, search, errors.
- [API](api/index.md): programmatic build, configuration, plugins, React components, errors, compatibility.
- [Architecture](architecture/overview.md): pipeline, renderers, filesystem safety, testing.
- [Development](development/setup.md): setup, scripts, testing, lint, build, contributing, release, self-hosting this documentation site.
- [Troubleshooting](troubleshooting/index.md): failure-by-failure fixes.
- [Reference](reference/feature-support.md): feature matrix, glossary, FAQ, known limitations, coverage inventory.

## Conventions used by this corpus

- One `.md` file equals one page. Routes derive deterministically from file paths: `md/guides/deployment.md` → `/guides/deployment`, `md/cli/index.md` → `/cli`.
- No frontmatter is used: page titles come from the first H1, keeping pages readable in any Markdown viewer.
- Links are relative Markdown links; every link target exists in this corpus.
- Command, flag, default, and API claims were verified against the shipped `dist/` bundle, live `--help` output, and an executed scratch build — not from memory.
