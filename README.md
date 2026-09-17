# @vetwo/docs

[![npm version](https://img.shields.io/npm/v/@vetwo/docs.svg)](https://www.npmjs.com/package/@vetwo/docs)
[![license](https://img.shields.io/npm/l/@vetwo/docs.svg)](https://github.com/vetwo/docs/blob/main/LICENSE)
[![build status](https://img.shields.io/github/actions/workflow/status/vetwo/docs/ci.yml?branch=main)](https://github.com/vetwo/docs/actions)

The easiest and most powerful documentation generator for JavaScript and TypeScript. Generate beautiful, performant documentation sites from Markdown, MDX, and your source code.

## Features

- **Zero-config setup** -- Get started with a single command; sensible defaults out of the box
- **Markdown and MDX** -- Write content in Markdown with full MDX support for interactive components
- **API documentation** -- Automatically generate API docs from your TypeScript source code and JSDoc comments
- **Built-in search** -- Full-text search index generated at build time with zero runtime dependencies
- **Plugin system** -- Extend functionality with a lifecycle-based plugin architecture
- **Syntax highlighting** -- Beautiful code blocks powered by Shiki with support for hundreds of languages
- **SEO optimized** -- Automatic sitemap, robots.txt, Open Graph tags, and Twitter Card metadata
- **RSS feed** -- Generate an RSS feed for your documentation changelog or blog
- **Table of contents** -- Automatic heading extraction and configurable depth
- **Monorepo support** -- Detects and works with npm, pnpm, yarn, and Bun workspaces
- **File watching** -- Rebuild on file changes during development
- **Caching** -- Incremental builds with content-based caching
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

This creates a `docs.config.ts` with your project's name and description, and a `docs/index.md` file.

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
| `source` | `string` | `"./src"` | Directory containing your Markdown files |
| `output` | `string` | `"./docs"` | Output directory for generated files |
| `baseUrl` | `string` | `""` | Base URL for sitemap and canonical links |
| `theme` | `string \| ThemeConfig` | `"default"` | Theme name or custom theme configuration |
| `nav` | `NavConfig` | `undefined` | Top navigation bar configuration |
| `sidebar` | `SidebarConfig` | `{ auto: true, groups: [], collapsed: false }` | Sidebar navigation configuration |
| `seo` | `SeoConfig` | `{}` | SEO metadata configuration |
| `search` | `SearchConfig` | `{ enabled: true, indexFields: ["title", "content"], maxResults: 10 }` | Search configuration |
| `versioning` | `VersioningConfig` | `{ enabled: false, current: "", versions: [] }` | Documentation versioning |
| `sitemap` | `boolean` | `true` | Generate a sitemap.xml file |
| `rss` | `boolean` | `false` | Generate an RSS feed |
| `robots` | `boolean` | `true` | Generate a robots.txt file |
| `watch` | `boolean` | `false` | Enable file watching |
| `clean` | `boolean` | `true` | Clean output directory before building |
| `cache` | `boolean` | `true` | Enable build caching |
| `ignore` | `string[]` | `["node_modules", "dist", "build", ".git"]` | Glob patterns to ignore |
| `include` | `string[]` | `["*.md", "*.mdx"]` | Glob patterns to include |
| `rehypePlugins` | `string[]` | `[]` | Rehype plugins to use |
| `remarkPlugins` | `string[]` | `[]` | Remark plugins to use |
| `plugins` | `Plugin[]` | `[]` | Plugins to register |
| `markdown` | `MarkdownConfig` | `{ gfm: true, breaks: false, toc: true, tocDepth: 3, syntaxHighlighting: true }` | Markdown processing options |
| `api` | `ApiConfig` | `{ enabled: false, source: "./src", include: [], exclude: [], readme: true }` | API documentation generation options |

## CLI Commands

| Command | Description |
|---|---|
| `docs init` | Safely bootstrap a documentation workspace and AI agent skill |
| `docs dev` | Start development server with live reload |
| `docs watch` | Watch for file changes and rebuild |
| `docs build` | Build documentation for production |
| `docs generate` | Alias for `build` |
| `docs clean` | Remove generated output and cache |
| `docs doctor` | Run diagnostics on your documentation setup |
| `docs upgrade` | Upgrade @vetwo/docs to the latest version |

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

@vetwo/docs follows a layered architecture with strict dependency direction:
`CLI → Engine → Pipeline → Domain Layers → Utilities`. The engine exposes a
clean lifecycle (`createDocsEngine()` → `initialize()` → `build()` →
`dispose()`) backed by a lightweight service container.

The pipeline itself runs distinct stages:

```
init -> discover -> config -> load -> transform -> generate -> output -> done
```

1. **Discovery** -- Scans the source directory for Markdown files and detects project type (library, application, monorepo)
2. **Configuration** -- Loads and resolves the configuration file
3. **Loading** -- Parses Markdown files, extracts frontmatter, headings, and links
4. **Transformation** -- Applies remark/rehype plugins and custom transformations
5. **Generation** -- Generates search index, API docs, sitemap, RSS feed, and navigation
6. **Output** -- Writes all generated files to the output directory

### Key Modules

| Module | Purpose |
|---|---|
| `src/engine/` | DocsEngine lifecycle, service container, `build()` entry |
| `src/pipeline/` | Build context and pipeline orchestration |
| `src/scanner/` | File and project discovery |
| `src/config/` | Configuration loading and validation |
| `src/features/` | Feature generators (search, API docs, SEO, RSS, navigation) |
| `src/plugins/` | Plugin registry and built-in plugins |
| `src/renderer/` | HTML output rendering |
| `src/generator/`, `src/analyzer/` | Auto source-code documentation |
| `src/cache/` | Build caching |
| `src/logger/` | Logging utilities |

Old module paths (`src/core/`, `src/discovery/`, `src/renderers/`,
`src/templates/`) still resolve via re-export facades; see `MIGRATION.md`.

## Contributing

Contributions are welcome. Please read the [Contributing Guide](./CONTRIBUTING.md) before submitting a pull request.

## Support

- [GitHub Issues](https://github.com/vetwo/docs/issues) -- Bug reports and feature requests
- [GitHub Discussions](https://github.com/vetwo/docs/discussions) -- Questions and community support
- [Security Policy](./SECURITY.md) -- Report security vulnerabilities

## License

[MIT](./LICENSE) -- Copyright (c) vetwo contributors
# Docs
# Docs
# Docs
