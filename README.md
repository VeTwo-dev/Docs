# @vetwo/docs

[![npm version](https://img.shields.io/npm/v/@vetwo/docs.svg)](https://www.npmjs.com/package/@vetwo/docs)
[![license](https://img.shields.io/npm/l/@vetwo/docs.svg)](https://github.com/vetwo/docs/blob/main/LICENSE)
[![build status](https://img.shields.io/github/actions/workflow/status/vetwo/docs/ci.yml?branch=main)](https://github.com/vetwo/docs/actions)

The easiest and most powerful documentation generator for JavaScript and TypeScript. Generate documentation sites from your Markdown and MDX content — a Next.js + Fumadocs site as the primary target and portable static HTML as the secondary target.

**Scope:** `@vetwo/docs` renders *authored content*. It is not a general-purpose source-code intelligence engine, API analyzer, CMS, or AI documentation generator. API inference from TypeScript sources remains available as an explicit opt-in legacy path (see [COMPATIBILITY.md](./COMPATIBILITY.md)).

## Features

- **Content-first** -- Your Markdown/MDX is the source of truth; nothing is invented when content is missing
- **Two site targets** -- Next.js + Fumadocs project and dependency-free static HTML from one model
- **Markdown and MDX** -- Frontmatter, GFM, code spans, images, assets, and MDX custom components
- **Blog, search, navigation** -- Dated posts with synthesized listing, build-time search index, deterministic nav
- **API documentation (legacy opt-in)** -- API reference from TypeScript sources via `content.pipeline: "legacy"`
- **Owned, safe output** -- Generated-file manifest, stale-output reconciliation, user files never overwritten
- **Built-in search** -- Full-text search index generated at build time with zero runtime dependencies
- **Plugin system** -- Extend functionality with a lifecycle-based plugin architecture
- **Syntax highlighting** -- Beautiful code blocks with support for hundreds of languages
- **SEO optimized** -- Sitemap, robots.txt, Open Graph tags, and Twitter Card metadata (pipeline artifacts)
- **Table of contents** -- Automatic heading extraction and configurable depth
- **Monorepo support** -- Detects and works with npm, pnpm, yarn, and Bun workspaces
- **File watching** -- Rebuild on file changes during development
- **TypeScript-first** -- Written in TypeScript with full type definitions

## Installation

```bash
# npm
npm install @vetwo/docs --save-dev

# pnpm
pnpm add @vetwo/docs --save-dev

# yarn
yarn add @vetwo/docs --dev

# bun
bun add @vetwo/docs --dev
```

## Quick Start

### 1. Initialize your project

```bash
npx docs init
```

This scaffolds a `docs.config.ts` and starter content. Preview the plan first with `npx docs init --dry-run`.

### 2. Edit the configuration

```ts
// docs.config.ts
import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "My Project",
  description: "Documentation for my project",
  source: "./docs",
  output: "./docs-site",
});
```

### 3. Add your content

Write Markdown files in the `docs/` directory:

```md
---
title: Getting Started
description: How to get started with My Project
---

# Getting Started

Welcome to the documentation.
```

### 4. Build your documentation

```bash
npx docs build
```

Your documentation site is generated in the `docs-site/` directory.

### 5. Watch for changes

```bash
npx docs watch
```

The documentation rebuilds automatically when you modify files in the source directory.

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Documentation"` | The title of your documentation site |
| `description` | `string` | `"Project documentation"` | Site description used in meta tags |
| `source` | `string` | `"./src"` | Directory containing your Markdown files (set to `"./docs"` for content-first projects) |
| `output` | `string` | `"./docs"` | Output directory for generated files |
| `baseUrl` | `string` | `"/"` | Base URL for sitemap and canonical links |
| `theme` | `string \| ThemeConfig` | `"default"` | Theme name or custom theme configuration |
| `nav` | `NavConfig` | `undefined` | Top navigation bar configuration |
| `sidebar` | `SidebarConfig` | `{ auto: true, groups: [], collapsed: false }` | Sidebar navigation configuration |
| `seo` | `SeoConfig` | `{}` | SEO metadata configuration |
| `search` | `SearchConfig` | `{ enabled: true, engine: "minisearch", indexFields: ["title", "content", "category"], maxResults: 20 }` | Search configuration (`engine` is `"minisearch"` or `"pagefind"`) |
| `versioning` | `VersioningConfig` | `{ enabled: false, current: "latest", versions: [] }` | Documentation versioning |
| `sitemap` | `boolean` | `true` | Generate a sitemap.xml file |
| `rss` | `boolean` | `false` | Generate an RSS feed |
| `robots` | `boolean` | `true` | Generate a robots.txt file |
| `og` | `boolean` | `true` | Open Graph images (pipeline artifact) |
| `watch` | `boolean` | `false` | Reserved key: no runtime effect in 1.0.0 (use `docs watch`) |
| `clean` | `boolean` | `true` | Reserved key: no runtime effect in 1.0.0 (use `docs clean`) |
| `cache` | `boolean` | `true` | Enable build caching |
| `ignore` | `string[]` | `["node_modules", "dist", "build", ".git", ".turbo", "coverage", ".vetwo", ...]` | Glob patterns to ignore |
| `include` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 |
| `rehypePlugins` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 |
| `remarkPlugins` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 |
| `plugins` | `Plugin[]` | `[]` | Plugins to register |
| `markdown` | `MarkdownConfig` | `{ gfm: true, breaks: false, toc: true, tocDepth: 3, syntaxHighlighting: true }` | Markdown processing options |
| `api` | `ApiConfig` | `{ enabled: false, source: "./src", include: [], exclude: [...test/spec/dts], readme: true }` | API documentation options (legacy opt-in; see [COMPATIBILITY.md](./COMPATIBILITY.md)) |
| `content` | `ContentPipelineConfig` | `{ pipeline: "canonical" }` | Content pipeline: `"canonical"` builds from your Markdown/MDX (default, no source analysis); `"legacy"` opts into inference from TypeScript sources |

## CLI Commands

| Command | Description |
|---|---|
| `docs init` | Safely bootstrap a documentation workspace (dry-run, non-interactive modes) |
| `docs dev` | Start development server with live reload |
| `docs watch` | Watch for file changes and rebuild |
| `docs build` | Build documentation for production |
| `docs generate` | Alias for `build`, plus optional content regeneration (`--dry-run`, `--force`) |
| `docs serve [dir]` | Serve built output over HTTP (no rebuild, no writes) |
| `docs clean` | Remove generated output and regenerable state (`--dry-run` previews) |
| `docs doctor` | Run diagnostics on your documentation setup (`--json` supported) |
| `docs upgrade` | Check/install updates for `@vetwo/*` packages (`--check` for report only) |
| `docs plugin`, `docs theme` | Manage plugins and themes |

Full reference with flags, side effects, exit codes, and the analysis/content groups: [CLI.md](./CLI.md).

### Command Options

```bash
# Specify a custom config file
docs build --config ./my-config.ts

# Start dev server on a specific port
docs dev --port 8080
```

## Plugin System

@vetwo/docs has a lifecycle-based plugin system that hooks into different stages of the build pipeline.

### Built-in Plugins

```ts
import { defineDocs, openApi, mermaid } from "@vetwo/docs";

export default defineDocs({
  plugins: [
    openApi({ spec: "./openapi.json" }),
    mermaid(),
  ],
});
```

### Creating a Plugin

A plugin is an object with a `name`, `version`, and a set of lifecycle hooks:

```ts
import type { Plugin } from "@vetwo/docs";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  hooks: {
    init(ctx) {
      ctx.log.info("Plugin initialized");
    },
    discover(ctx) {
      ctx.log.info(`Found ${ctx.sourceFiles.length} source files`);
    },
    transform(ctx) {
      for (const page of ctx.pages) {
        // Modify page content
      }
    },
    generate(ctx) {
      ctx.log.info("Generating additional output");
    },
  },
};
```

### Available Lifecycle Hooks

| Hook | When it runs |
|---|---|
| `init` | At the start of the build, before any processing |
| `discover` | After source files have been discovered |
| `config` | After configuration has been resolved |
| `load` | When pages are being loaded and parsed |
| `transform` | When page content is being transformed |
| `generate` | During output generation |
| `output` | When writing files to disk |
| `done` | After the build completes |
| `error` | When an error occurs during the build |

### Hook Context

Each hook receives a `HookContext` object:

```ts
interface HookContext {
  ctx: BuildContextMutable;  // The mutable build context
  config: DocsConfig;       // The resolved configuration
  log: Logger;              // The logger instance
}
```

## Architecture

Authored Markdown/MDX flows through one canonical pipeline — discovery and normalization, the site model, the versioned Documentation IR, output planning, and target renderers — into owned, reconciled output. The engine (`createDocsEngine()` → `initialize()` → `build()` → `dispose()`) orchestrates the lifecycle. Details: [ARCHITECTURE.md](./ARCHITECTURE.md). Safety guarantees (ownership, containment, cleanup, process safety): [SAFETY.md](./SAFETY.md). Retained legacy behavior: [COMPATIBILITY.md](./COMPATIBILITY.md).

## Documentation map

- [HOW_WORKS.md](./HOW_WORKS.md) — developer and contributor guide: configuration, content authoring, plugins, themes, search, errors, testing.
- [CLI.md](./CLI.md) — complete command reference with flags and exit codes.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — canonical pipeline, engine lifecycle, module responsibilities.
- [SAFETY.md](./SAFETY.md) — ownership, reconciliation, path containment, process safety.
- [COMPATIBILITY.md](./COMPATIBILITY.md) — retained legacy surfaces and open decisions.
- [FAQ.md](./FAQ.md) — frequently asked questions and troubleshooting.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — development setup, scripts, workflow.
- [skills/docs-bootstrap/SKILL.md](./skills/docs-bootstrap/SKILL.md) — agent skill for bootstrapping docs in a new project.

## Contributing

Contributions are welcome. Please read the [Contributing Guide](./CONTRIBUTING.md) before submitting a pull request.

## Support

- [GitHub Issues](https://github.com/vetwo/docs/issues) -- Bug reports and feature requests
- [GitHub Discussions](https://github.com/vetwo/docs/discussions) -- Questions and community support
- [Security Policy](./SECURITY.md) -- Report security vulnerabilities

## License

[MIT](./LICENSE) -- Copyright (c) vetwo contributors
