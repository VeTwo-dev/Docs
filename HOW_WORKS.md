# HOW_WORKS.md — Developer & Contributor Guide

Complete technical documentation for `@vetwo/docs`. Everything you need to understand, use, extend, or contribute to this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Installation](#installation)
3. [Configuration Reference](#configuration-reference)
4. [CLI Commands](#cli-commands)
5. [Automatic Source Documentation](#automatic-source-documentation)
6. [Markdown Features](#markdown-features)
7. [Plugin System](#plugin-system)
8. [Built-in Plugins](#built-in-plugins)
9. [Theme System](#theme-system)
10. [React Integration](#react-integration)
11. [Search](#search)
12. [SEO & Sitemap](#seo--sitemap)
13. [RSS Feed](#rss-feed)
14. [Open Graph Images](#open-graph-images)
15. [API Documentation](#api-documentation)
16. [Navigation](#navigation)
17. [Sidebar](#sidebar)
18. [Caching](#caching)
19. [Monorepo Support](#monorepo-support)
20. [Error Handling](#error-handling)
21. [Architecture](#architecture)
22. [Project Structure](#project-structure)
23. [Testing](#testing)
24. [Contributing](#contributing)

---

## Project Overview

`@vetwo/docs` is a documentation generator built on a **pipeline architecture** with 8 lifecycle stages:

```
init → discover → config → load → transform → generate → output → done
```

- **Plugin-first design** — core never knows implementation details
- **Convention over configuration** — zero-config works
- **TypeScript-first** — strict types, no `any`, full `.d.ts` exports
- **Dual ESM/CJS** — nested `import`/`require` export conditions

### Stats

- **75** source files, **36** test files, **600** tests
- **41** example projects
- **60** documentation pages
- ~17k lines of TypeScript

---

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

### Package Exports

```json
{
  ".": "Main entry (build pipeline, config, plugins)",
  "./cli": "CLI entry point",
  "./config": "Configuration utilities",
  "./react": "React components",
  "./package.json": "Package metadata"
}
```

---

## Configuration Reference

Create a `docs.config.ts` in your project root:

```ts
import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "My Project",
  description: "Project documentation",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://example.com",
  theme: "default",
  // ...
});
```

### All Options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Documentation"` | Site title |
| `description` | `string` | `"Project documentation"` | Site description for meta tags |
| `source` | `string` | `"./src"` | Directory containing Markdown files |
| `output` | `string` | `"./docs"` | Output directory |
| `baseUrl` | `string` | `""` | Base URL for sitemap and canonical links |
| `theme` | `string \| ThemeConfig` | `"default"` | Theme name or custom config |
| `nav` | `NavConfig` | `undefined` | Top navigation bar |
| `sidebar` | `SidebarConfig` | `{ auto: true, groups: [], collapsed: false }` | Sidebar navigation |
| `seo` | `SeoConfig` | `{}` | SEO metadata |
| `search` | `SearchConfig` | `{ enabled: true, ... }` | Search configuration |
| `versioning` | `VersioningConfig` | `{ enabled: false, ... }` | Version switching |
| `sitemap` | `boolean` | `true` | Generate sitemap.xml |
| `rss` | `boolean` | `false` | Generate RSS feed |
| `robots` | `boolean` | `true` | Generate robots.txt |
| `watch` | `boolean` | `false` | Enable file watching |
| `clean` | `boolean` | `true` | Clean output before build |
| `cache` | `boolean` | `true` | Enable build caching |
| `ignore` | `string[]` | `["node_modules", "dist", ...]` | Glob patterns to ignore |
| `include` | `string[]` | `["*.md", "*.mdx"]` | Glob patterns to include |
| `rehypePlugins` | `string[]` | `[]` | Rehype plugins |
| `remarkPlugins` | `string[]` | `[]` | Remark plugins |
| `plugins` | `Plugin[]` | `[]` | Lifecycle plugins |
| `markdown` | `MarkdownConfig` | `{ gfm: true, toc: true, ... }` | Markdown processing options |
| `api` | `ApiConfig` | `{ enabled: false, ... }` | API documentation generation |
| `generator` | `GeneratorConfigInput` | `undefined` | Source-code doc generation settings |

### Markdown Config

```ts
markdown: {
  gfm: true,            // GitHub Flavored Markdown
  breaks: false,        // Convert \n to <br>
  toc: true,            // Auto-generate table of contents
  tocDepth: 3,          // Heading depth for TOC
  syntaxHighlighting: true,
  smartypants: true,    // Curly quotes, em-dashes
  raw: true,            // Preserve raw HTML
  lineHighlighting: true,
  diffHighlighting: true,
  focusRegions: true,
}
```

### API Config

```ts
api: {
  enabled: true,
  source: "./src",
  include: ["**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.d.ts"],
  readme: true,
}
```

### Generator Config

```ts
generator: {
  enabled: true,        // Enable auto-generation
  mode: "hybrid",       // "hybrid" | "incremental" | "full"
  output: "./generated-docs",
  overwrite: false,
  // Section toggles (all default to true):
  api: true,
  architecture: true,
  guides: true,
  configuration: true,
  cli: true,
  faq: true,
  troubleshooting: true,
  examples: true,
  sidebar: true,
  navigation: true,
  search: true,
}
```

### Sidebar Config

Sidebar items can be strings (auto-derives label from path) or objects:

```ts
sidebar: {
  auto: false,
  collapsed: false,
  groups: [
    {
      title: "Getting Started",
      items: [
        "/introduction",           // string — label auto-derived
        { label: "Setup", href: "/setup" },  // object — explicit
      ],
    },
  ],
}
```

### Nav Config

```ts
nav: {
  items: [
    { label: "Guide", href: "/guide" },
    {
      label: "Resources",
      href: "/resources",
      items: [
        { label: "Examples", href: "/examples" },
        { label: "FAQ", href: "/faq" },
      ],
    },
  ],
}
```

---

## CLI Commands

### Global Options

```bash
docs [command] --config <path>   # Custom config file
docs [command] --verbose         # Verbose logging
docs [command] --silent          # Errors only
```

### `docs init`

Scaffolds `docs.config.ts` and `docs/index.md` in the current project.

### `docs build`

Builds documentation for production. Output goes to the `output` directory.

| Flag | Description |
|---|---|
| `--clean` | Clean output dir before build |

### `docs dev`

Starts a local dev server with live reload. Rebuilds on file changes.

| Flag | Description |
|---|---|
| `--port <number>` | Server port (default: 3000) |
| `--open` | Open browser on start |

### `docs watch`

Watches for file changes and rebuilds. Runs until manually stopped.

### `docs generate`

Generates documentation pages from source code analysis (filesystem scanning, package.json parsing, config detection).

| Flag | Description |
|---|---|
| `--clean` | Clean generated output first |
| `--overwrite` | Overwrite existing generated files |
| `--api-only` | Generate only API documentation |
| `--examples-only` | Generate only examples and recipes |
| `--changed` | Only regenerate changed files |

**What it analyzes:**
- Source file structure and exports
- package.json (scripts, dependencies, metadata)
- Config files (TypeScript, ESLint, Prettier, etc.)
- CI/CD setup (.github/workflows)
- TypeScript, testing, Docker presence
- Framework detection (React, Vue, Next.js, etc.)
- Package manager detection

**Output:**
- 8 documentation pages (overview, architecture, guides, configuration, CLI, FAQ, examples, troubleshooting)
- 4 metadata files (sidebar, navigation, search index, API metadata)

### `docs clean`

Removes the output directory and build cache.

### `docs doctor`

Runs diagnostics on your setup — checks config, dependencies, TypeScript, output directory.

### `docs upgrade`

Checks for and installs the latest version of `@vetwo/docs`.

### `docs plugin`

Manages plugins — list installed, add, remove.

### `docs theme`

Manages themes — list available, switch, preview.

---

## Automatic Source Documentation

The `docs generate` command auto-generates documentation from your source code.

### How It Works

1. **Analyze** — Scans project root for package.json, source files, config files
2. **Detect** — Identifies project type, framework, package manager, TypeScript presence
3. **Generate** — Creates pages based on analysis results
4. **Metadata** — Builds sidebar, navigation, search index from generated pages
5. **Cache** — Stores results for incremental regeneration

### Generated Pages

| Page | Content |
|---|---|
| `overview.mdx` | Project summary, scripts table, features |
| `architecture.mdx` | Directory tree, source/config file counts |
| `guides/getting-started.mdx` | Quick start guide with install commands |
| `configuration.mdx` | Config files detected, TypeScript settings |
| `cli.mdx` | Package scripts, CLI entry points |
| `faq.mdx` | Package info, feature flags |
| `examples.mdx` | Usage examples from public exports |
| `troubleshooting.mdx` | Common issues, CI detection |

### Programmatic API

```ts
import { generateDocs } from "@vetwo/docs";

const result = await generateDocs({
  rootDir: "/path/to/project",
  logger,
  generatorConfig: { enabled: true, mode: "hybrid" },
  clean: true,
  overwrite: false,
});

console.log(result.stats.totalPages);     // 8
console.log(result.stats.totalMetadata);  // 4
```

### Cache

Generated files are cached in `.docs-cache/generator/`. The cache tracks:
- File paths and content hashes
- Generation timestamps
- Skipped files (unchanged since last run)

Use `--changed` flag for incremental regeneration.

---

## Markdown Features

### Frontmatter

```yaml
---
title: Page Title
description: Page description
order: 1
category: Getting Started
---
```

### Syntax Highlighting

````md
```ts
const x: number = 42;
```
````

Powered by Shiki with support for hundreds of languages.

### Line Highlighting

````md
```ts {1,3-5}
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
```
````

### Diff Highlighting

````md
```diff
- old code
+ new code
```
````

### Focus Regions

````md
```ts focus=1-2
const focused = "lines 1-2 are focused";
const rest = "not focused";
```
````

### Raw HTML

Markdown files support raw HTML when `markdown.raw: true` (default).

### MDX

MDX files (`.mdx`) support React components directly:

```mdx
import { Callout } from "@vetwo/docs/react";

# My Page

<Callout type="info">
  This is an info callout.
</Callout>
```

---

## Plugin System

Plugins hook into the build pipeline lifecycle.

### Lifecycle Hooks

| Hook | When |
|---|---|
| `init` | Build starts, before any processing |
| `discover` | Source files discovered |
| `config` | Configuration resolved |
| `load` | Pages loaded and parsed |
| `transform` | Page content being transformed |
| `generate` | Output generation |
| `output` | Writing files to disk |
| `done` | Build completes |
| `error` | Error occurs |

### Creating a Plugin

```ts
import type { Plugin } from "@vetwo/docs";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  hooks: {
    init(ctx) {
      ctx.log.info("Plugin initialized");
    },
    transform(ctx) {
      for (const page of ctx.pages) {
        // Modify page content
      }
    },
  },
};
```

### Hook Context

```ts
interface HookContext {
  ctx: BuildContextMutable;
  config: DocsConfig;
  log: Logger;
}
```

---

## Built-in Plugins

### `openApi()`

Generates API documentation from OpenAPI/Swagger specs.

```ts
import { openApi } from "@vetwo/docs";

export default defineDocs({
  plugins: [
    openApi({ spec: "./openapi.json" }),
  ],
});
```

Parses the spec and generates endpoint pages with method, path, parameters, and response info.

### `mermaid()`

Wraps code blocks in `<div class="mermaid">` and appends the Mermaid CDN script.

```ts
import { mermaid } from "@vetwo/docs";

export default defineDocs({
  plugins: [mermaid()],
});
```

---

## Theme System

### Built-in Themes

| Theme | Style |
|---|---|
| `default` | Blue accent, clean layout |
| `midnight` | Purple accent, dark mode |
| `forest` | Green accent, nature-inspired |

### Custom Theme

```ts
export default defineDocs({
  theme: {
    colors: {
      primary: "#3b82f6",
      background: "#ffffff",
      text: "#1f2937",
    },
    fonts: {
      body: "Inter, sans-serif",
      mono: "Fira Code, monospace",
    },
  },
});
```

### Dark Mode

Themes support automatic dark mode via `prefers-color-scheme`. Built-in themes include dark variants.

---

## React Integration

```tsx
import { Callout, CodeBlock, Tabs, Tab } from "@vetwo/docs/react";

export default function MyPage() {
  return (
    <>
      <Callout type="warning">
        This is a warning.
      </Callout>

      <CodeBlock language="typescript" title="example.ts">
        {`const x = 42;`}
      </CodeBlock>

      <Tabs>
        <Tab label="npm">npm install foo</Tab>
        <Tab label="pnpm">pnpm add foo</Tab>
      </Tabs>
    </>
  );
}
```

### Available Components

- `Callout` — Alert boxes (info, warning, error, tip)
- `CodeBlock` — Syntax-highlighted code with title, line numbers
- `Tabs` / `Tab` — Tabbed content
- Custom components via plugin system

---

## Search

Full-text search index generated at build time. Zero runtime dependencies.

```ts
search: {
  enabled: true,
  engine: "minisearch",      // or "pagefind"
  indexFields: ["title", "content", "category"],
  maxResults: 20,
}
```

### Engines

| Engine | Description |
|---|---|
| `minisearch` | In-memory search, fast, zero deps |
| `pagefind` | Static search, smaller index, better ranking |

---

## SEO & Sitemap

Automatic SEO metadata generation:

```ts
seo: {
  title: "My Project",
  description: "Project documentation",
  twitter: "@myproject",
}
```

**Generated files:**
- `sitemap.xml` — All pages with lastmod
- `robots.txt` — Crawl directives
- Open Graph meta tags on every page
- Twitter Card meta tags

---

## RSS Feed

Generates `atom.xml` for documentation changelogs:

```ts
rss: true  // in config
```

---

## Open Graph Images

Auto-generated OG images using Satori + resvg:

```ts
og: true  // in config
```

Generates `og-image.png` with project title and description.

---

## API Documentation

TypeDoc-powered API documentation:

```ts
api: {
  enabled: true,
  source: "./src",
  include: ["**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.d.ts"],
  readme: true,
}
```

Extracts functions, classes, interfaces, types, and enums with JSDoc descriptions.

---

## Navigation

### Auto Navigation

When `sidebar.auto: true`, navigation is built from discovered pages:

```ts
sidebar: { auto: true }
```

### Manual Navigation

```ts
nav: {
  items: [
    { label: "Guide", href: "/guide" },
    {
      label: "More",
      href: "/more",
      items: [
        { label: "Examples", href: "/examples" },
      ],
    },
  ],
}
```

Navigation metadata is saved to `navigation.json` in the output directory.

---

## Sidebar

Sidebar items support both string paths and explicit objects:

```ts
sidebar: {
  auto: false,
  collapsed: false,
  groups: [
    {
      title: "Getting Started",
      items: [
        "/introduction",                              // string → auto label
        { label: "Setup", href: "/setup" },          // explicit object
        { label: "Advanced", href: "/adv", badge: "New" },  // with badge
      ],
    },
  ],
}
```

String items auto-derive labels: `"/getting-started"` → `"Getting Started"`.

---

## Caching

Build caching for faster incremental builds:

```ts
cache: true  // in config
```

Cache stored in `.docs-cache/`. Tracks:
- Content hashes for each file
- Last build timestamps
- Dependency graph

Cache is invalidated when source files change.

---

## Monorepo Support

Detects and works with:
- npm workspaces
- pnpm workspaces
- Yarn workspaces
- Bun workspaces
- Lerna

Package manager is auto-detected from lock files:
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `bun.lock` / `bun.lockb` → bun
- `package-lock.json` → npm

---

## Error Handling

### Error Classes

Specialized error hierarchy:

| Class | Use Case |
|---|---|
| `DocsError` | Base class for all errors |
| `ConfigError` | Configuration issues |
| `ConfigNotFoundError` | Missing config file |
| `ConfigInvalidError` | Invalid config schema |
| `BuildError` | Build pipeline failures |
| `FileError` | File system errors |
| `FileNotFoundError` | Missing files |
| `PermissionError` | Access denied |
| `PluginError` | Plugin failures |
| `PluginHookError` | Plugin hook errors |
| `RendererError` | Rendering failures |
| `ValidationError` | Validation errors |
| `TypeDocError` | TypeDoc integration errors |
| `PagefindError` | Pagefind search errors |
| `InternalError` | Unexpected internal errors |

### Error Codes

28 structured error codes for programmatic handling:

```ts
import { ErrorCode } from "@vetwo/docs";

if (error.code === ErrorCode.CONFIG_NOT_FOUND) {
  // Handle missing config
}
```

### Error Formatting

Human-readable error output:

```ts
import { formatError } from "@vetwo/docs";

console.log(formatError(error));
// ✖ ConfigError: Configuration validation failed
//   - title: Required
//   Suggestion: Run `docs init` to create a config file.
//   Error Code: CONFIG_INVALID
```

---

## Architecture

`@vetwo/docs` is organised as a **layered architecture** with strict dependency
direction. Every layer is a self-contained folder that can be reasoned about,
tested, and replaced independently.

```
CLI ──────→ Engine ──────→ Pipeline ──────→ Domain Layers ──────→ Utilities
(src/cli)   (src/engine)   (src/pipeline)   (config, scanner,      (filesystem,
                                            features, generator,     cache, utils,
                                            renderer, analyzer,      logger, ...)
                                            plugins, themes)
```

### Layer responsibilities

| Layer | Folder | Responsibility |
|---|---|---|
| CLI | `src/cli/` | Command-line surface (`build`, `dev`, `generate`, `doctor`, …). Thin, delegates to the engine. |
| Engine | `src/engine/` | `DocsEngine` lifecycle (`createDocsEngine()` → `initialize()` → `build()` → `dispose()`), service container, service wiring. |
| Pipeline | `src/pipeline/` | Build context creation and the stage pipeline that runs plugins and feature generators. |
| Domain | `src/config/`, `src/scanner/`, `src/features/`, `src/plugins/`, `src/themes/`, `src/generator/`, `src/renderer/`, `src/analyzer/`, `src/compiler/`, `src/graph/` | Feature logic: config loading/validation, file & project discovery, markdown processing, feature output, plugins, themes, page generation, analysis, and reserved compiler/graph surfaces. |
| Utilities | `src/filesystem/`, `src/cache/`, `src/utils/`, `src/logger/`, `src/errors/`, `src/components/`, `src/hooks/`, `src/dev-server/`, `src/react/` | Shared infrastructure used by upper layers. |

### Engine lifecycle

```
createDocsEngine(options)        # wire up the service container
  └─ initialize()                # detect project + load config + enable cache
       └─ build()                # discover files → create context → run pipeline
            └─ dispose()         # release services (engine can be re-initialized)
```

The engine can also run subsystems independently:
`runPipeline(ctx)`, `runGenerator(options)`, `runAnalyzer(rootDir)`.

### Pipeline stages

```
init → discover → config → load → transform → generate → output → done
```

1. **init** — Set up build context, logger, temp directories
2. **discover** — Scan source directory, detect project type
3. **config** — Load and validate configuration
4. **load** — Parse Markdown, extract frontmatter, headings
5. **transform** — Apply remark/rehype plugins, custom transforms
6. **generate** — Create search index, API docs, sitemap, RSS
7. **output** — Write all files to disk
8. **done** — Clean up, report stats

### Key Modules

| Module | Purpose |
|---|---|
| `src/engine/` | `DocsEngine` lifecycle, `ServiceContainer`, service wiring, `build()` entry |
| `src/pipeline/` | Build context and pipeline orchestration |
| `src/scanner/` | File discovery and project detection (moved from `src/discovery/`) |
| `src/config/` | Configuration loading, validation (Zod), merging |
| `src/features/` | Feature generators (search, SEO, RSS, navigation, API docs) |
| `src/plugins/` | Plugin registry, built-in plugins (openApi, mermaid) |
| `src/renderer/` | HTML output rendering (moved from `src/renderers/`) |
| `src/generator/` | Auto source-code documentation generator (reorganised into `core/`, `pages/`, `metadata/`) |
| `src/analyzer/` | Project analysis for API documentation (moved from `src/generator/analyzer.ts`) |
| `src/compiler/`, `src/graph/` | Reserved layer surfaces (interfaces only, no behavior yet) |
| `src/cache/` | Content-based build caching |
| `src/logger/` | Logging (sync/async, chalk/ora) |
| `src/errors/` | Error hierarchy, codes, formatting |
| `src/components/` | Component registry (Callout, CodeBlock, Tabs) |
| `src/themes/` | Theme registry (default, midnight, forest) |
| `src/hooks/` | Hook system for plugins |
| `src/utils/` | Utilities (async, hash, HTML) |
| `src/dev-server/` | Development server |
| `src/react/` | React component bindings |

> **Backward-compatible facades.** Old module paths keep working via re-export
> facades: `src/core/index.ts` re-exports the engine + `createBuildContext`,
> `src/discovery/`, `src/renderers/`, `src/templates/`, and
> `src/generator/{analyzer,config,types,generators}` re-export their new
> locations. See `MIGRATION.md` for the full old → new path map.

### Data Flow

```
Source Files → Scanner → [Markdown Pages] → Pipeline → [HTML Pages]
                                                          ↓
Config ─────→ Engine ─────→ Pipeline ─────→ Generate → [Search Index, Sitemap, RSS, ...]
                                                          ↓
Plugins ────→ Hook into lifecycle ────────→ Output → [docs-site/]
```

---

## Project Structure

```
packages/docs/
├── src/                          # Source code
│   ├── index.ts                  # Main barrel export
│   ├── cli/                      # CLI entry point
│   ├── engine/                   # DocsEngine lifecycle, service container
│   │   ├── container.ts          # Lightweight typed ServiceContainer
│   │   ├── contracts/            # Service contracts (interfaces)
│   │   ├── services/             # Service wiring (logger, config, discovery, …)
│   │   └── index.ts              # createDocsEngine(), build()
│   ├── pipeline/                 # Build context + pipeline orchestration
│   ├── scanner/                  # File & project discovery (was src/discovery/)
│   ├── config/                   # Config loading, validation, types
│   ├── features/                 # Search, SEO, RSS, navigation, API docs
│   ├── plugins/                  # Plugin system, built-in plugins
│   ├── generator/                # Auto source-code doc generation
│   │   ├── core/                 # Generator types + config resolution
│   │   ├── pages/                # Page generators (8 pages)
│   │   ├── metadata/             # Metadata generators (sidebar, nav, search, API)
│   │   ├── cache.ts, writers.ts  # Generator cache, file output
│   │   └── index.ts              # Main orchestrator
│   ├── analyzer/                 # Project analysis (was generator/analyzer.ts)
│   ├── compiler/                 # Reserved compiler layer (interfaces only)
│   ├── graph/                    # Reserved graph layer (interfaces only)
│   ├── renderer/                 # HTML output rendering (was src/renderers/ + templates/)
│   ├── cache/                    # Build caching
│   ├── logger/                   # Logging
│   ├── errors/                   # Error classes, codes, formatting
│   ├── components/               # Component registry
│   ├── themes/                   # Theme registry
│   ├── hooks/                    # Hook system
│   ├── utils/                    # Utilities
│   ├── dev-server/               # Dev server
│   ├── react/                    # React bindings
│   └── (facades)                 # src/core/, src/discovery/, src/renderers/,
│                                 #   src/templates/, src/generator/analyzer.ts, …
├── test/                         # Isolated test processes (cwd-sensitive cases)
├── docs/                         # Documentation pages (60 files)
├── examples/                     # Example projects (41 projects)
├── generated-docs/               # Auto-generated documentation
├── docs-site/                    # Built documentation site
├── dist/                         # Compiled output (ESM + CJS + DTS)
├── docs.config.ts                # Documentation config (dogfooding)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── eslint.config.js
```

---

## Testing

### Run Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm coverage          # With coverage report
```

### Test Structure

- 36 test files, 600 tests
- Vitest as test runner
- Coverage thresholds: 90 statements / 75 branches / 90 functions / 90 lines
- Tests co-located with source (`*.test.ts`)

### Key Test Files

| File | Tests |
|---|---|
| `generator/index.test.ts` | 51 tests — full generation pipeline |
| `cli/index.test.ts` | 46 tests — all CLI commands |
| `features/api-docs.test.ts` | 9 tests — TypeDoc integration |
| `features/markdown.test.ts` | 33 tests — Markdown processing |
| `errors/format.test.ts` | 33 tests — Error formatting |
| `discovery/project.test.ts` | 32 tests — Project detection |
| `features/output.test.ts` | 31 tests — File output |

### Lint & Type Check

```bash
pnpm lint              # ESLint
pnpm lint:fix          # ESLint with auto-fix
pnpm format:check      # Prettier check
pnpm typecheck         # TypeScript compiler check
```

---

## Contributing

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
git clone https://github.com/vetwo/docs.git
cd docs/packages/docs
pnpm install
```

### Development Workflow

```bash
pnpm dev               # Watch mode — recompiles on change
pnpm test:watch        # Test watch mode
pnpm lint:fix          # Fix lint issues
```

### Commit Convention

Uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Adding tests
- `chore:` — Maintenance

### Before Submitting a PR

1. `pnpm lint` — No lint errors
2. `pnpm typecheck` — No type errors
3. `pnpm test` — All tests pass
4. `pnpm build` — Build succeeds

### CI/CD

GitHub Actions workflows:

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Push/PR to main | lint, typecheck, test, build |
| `test.yml` | Push/PR to main | Matrix tests (Node 18/20/22 × Linux/macOS/Windows) |
| `docs.yml` | Push/PR to main | Generate + build documentation |
| `release.yml` | Push to main | Changesets release |
| `codeql.yml` | Push/PR + weekly | Security analysis |

All workflows use pnpm for dependency management.

### Git Hooks

Pre-commit hook runs `lint-staged` which executes:
- `eslint --fix` on `.ts` files
- `prettier --write` on `.ts` files
