# HOW_WORKS.md — Developer & Contributor Guide

Complete technical documentation for `@vetwo/docs`. Everything you need to understand, use, extend, or contribute to this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Installation](#installation)
3. [Configuration Reference](#configuration-reference)
4. [CLI Commands](#cli-commands)
5. [Content-First Generation (Default)](#content-first-generation-default)
6. [Legacy Source Inference (Opt-In)](#legacy-source-inference-opt-in)
7. [Markdown Features](#markdown-features)
8. [Plugin System](#plugin-system)
9. [Built-in Plugins](#built-in-plugins)
10. [Theme System](#theme-system)
11. [React Integration](#react-integration)
12. [Search](#search)
13. [SEO & Sitemap](#seo--sitemap)
14. [RSS Feed](#rss-feed)
15. [Open Graph Images](#open-graph-images)
16. [API Documentation (legacy opt-in)](#api-documentation-legacy-opt-in)
17. [Navigation](#navigation)
18. [Sidebar](#sidebar)
19. [Caching](#caching)
20. [Monorepo Support](#monorepo-support)
21. [Error Handling](#error-handling)
22. [Architecture](#architecture)
23. [Project Structure](#project-structure)
24. [Testing](#testing)
25. [Contributing](#contributing)

---

## Project Overview

`@vetwo/docs` renders authored Markdown/MDX into documentation sites through one canonical pipeline — content discovery and normalization, the site model, the versioned Documentation IR, output planning, and target renderers — with manifest-tracked, reconciled output. The engine exposes a clean lifecycle (`createDocsEngine()` → `initialize()` → `build()` → `dispose()`).

- **Content-first design** — authored pages are the source of truth; nothing is invented
- **Convention over configuration** — `docs init` scaffolds a working setup
- **TypeScript-first** — strict types with full `.d.ts` exports
- **Dual ESM/CJS** — nested `import`/`require` export conditions

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
  ".": "Main entry (defineDocs, build, config, plugins, scanners)",
  "./cli": "CLI entry point",
  "./config": "Configuration utilities",
  "./react": "React components",
  "./api": "API analysis facade (legacy-compatible)",
  "./intelligence": "Project knowledge (legacy-compatible)",
  "./ai": "AI providers (legacy-compatible)",
  "./incremental": "Change detection (legacy-compatible)",
  "./documentation-compiler": "Inference pipeline (legacy-compatible)",
  "./documentation-relations": "Relation graph (legacy-compatible)",
  "./examples": "Example composition (legacy-compatible)",
  "./languages": "Language adapters",
  "./plugins": "Plugin system",
  "./renderers": "Site renderer factories",
  "./content": "Authored-content inspection",
  "./state": "Engine state",
  "./package.json": "Package metadata"
}
```

The full export map (16 subpaths plus `./package.json`) is pinned by packaging tests; the legacy-marked entries are supported compatibility surfaces, not part of the default workflow — see [COMPATIBILITY.md](./COMPATIBILITY.md).

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
| `source` | `string` | `"./src"` | Directory containing Markdown files (use `"./docs"` for content-first projects) |
| `output` | `string \| OutputLayoutConfig` | `"./docs"` | Output directory, or a workspace object (`directory` + `layout: { next, markdown, static, site }`) |
| `baseUrl` | `string` | `"/"` | Base URL for sitemap and canonical links |
| `theme` | `string \| ThemeConfig` | `"default"` | Theme name or custom config |
| `nav` | `NavConfig` | `undefined` | Top navigation bar |
| `sidebar` | `SidebarConfig` | `{ auto: true, groups: [], collapsed: false }` | Sidebar navigation |
| `seo` | `SeoConfig` | `{}` | SEO metadata |
| `search` | `SearchConfig` | `{ enabled: true, engine: "minisearch", indexFields: ["title", "content", "category"], maxResults: 20 }` | Search configuration |
| `versioning` | `VersioningConfig` | `{ enabled: false, current: "latest", versions: [] }` | Version switching |
| `sitemap` | `boolean` | `true` | Sitemap artifact (legacy pipeline output) |
| `rss` | `boolean` | `false` | RSS feed artifact (legacy pipeline output) |
| `robots` | `boolean` | `true` | robots.txt artifact (legacy pipeline output) |
| `og` | `boolean` | `true` | Open Graph image artifact |
| `watch` | `boolean` | `false` | Reserved key: no runtime effect in 1.0.0 (use `docs watch`) |
| `clean` | `boolean` | `true` | Reserved key: no runtime effect in 1.0.0 (use `docs clean`) |
| `cache` | `boolean` | `true` | Enable build caching |
| `ignore` | `string[]` | `["node_modules", "dist", "build", ".git", ".turbo", "coverage", ".vetwo", ...]` | Glob patterns to ignore |
| `include` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 (discovery uses extensions + `ignore`) |
| `rehypePlugins` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 |
| `remarkPlugins` | `string[]` | `[]` | Reserved key: no runtime effect in 1.0.0 |
| `plugins` | `Plugin[]` | `[]` | Lifecycle plugins |
| `markdown` | `MarkdownConfig` | `{ gfm: true, toc: true, ... }` | Markdown processing options |
| `api` | `ApiConfig` | `{ enabled: false, ... }` | API documentation options (legacy opt-in) |
| `content` | `ContentPipelineConfig` | `{ pipeline: "canonical" }` | `"canonical"` renders authored Markdown/MDX (default); `"legacy"` opts into source inference |

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

### API Config (legacy opt-in)

```ts
api: {
  enabled: true,
  source: "./src",
  include: ["**/*.ts"],
  exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
  readme: true,
}
```

Only read when `content.pipeline` is `"legacy"` (or by the `analyze`/`plan` tooling). See [COMPATIBILITY.md](./COMPATIBILITY.md).

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
| `-c, --config <path>` | Path to config file |
| `--json` | Emit machine-readable result (exit code 3 on failure) |

A failed build exits nonzero — validation errors are never downgraded to warnings.

### `docs dev`

Starts a local dev server with live reload. Rebuilds on file changes. Serves the configured output directory.

| Flag | Description |
|---|---|
| `-p, --port <number>` | Server port (default: 3000; must be 1–65535) |
| `-H, --host <name>` | Host to bind to (default: `localhost`) |
| `--open` | Open browser on start |

### `docs watch`

Watches for file changes and rebuilds. Runs until manually stopped.

### `docs generate`

Generates documentation. Without flags it behaves like `docs build`.

| Flag | Description |
|---|---|
| `--dry-run` | Plan safe content regeneration without writing files |
| `--force` | Update manually-edited generated pages (never protected ones) |

### `docs serve [dir]`

Serves an already-built directory over HTTP. Performs no build and no writes — the directory must already exist (run `docs build` first).

| Flag | Default | Description |
|---|---|---|
| `-p, --port <number>` | `3000` | Port to listen on (must be 1–65535) |
| `--host <name>` | `localhost` | Host to bind to |

> The full command reference, including `clean`, `doctor`, `upgrade`, `plugin`, `theme`, and the analysis/content groups (`plan`, `analyze`, `content`, `ai`, `integrations`, …), lives in [CLI.md](./CLI.md).

### `docs clean`

Removes the output directory and build cache.

### `docs doctor`

Runs diagnostics on your setup — checks config, dependencies, TypeScript, output directory.

### `docs upgrade`

Checks for and installs the latest version of `@vetwo/docs`.

### `docs plugin`

Manages plugins — list installed, add, remove.

### `docs theme`

Manages themes: `list` shows built-in themes (`default`, `midnight`, `forest`) plus installed theme packages; `install <name>` installs one via the detected package manager. See [CLI.md](./CLI.md).

---

## Content-First Generation (Default)

With the default `content.pipeline: "canonical"`, `docs build` / `docs generate` render **only your authored Markdown/MDX**:

1. **Discover** — finds `*.md`/`*.mdx` under the configured `source` root (deterministic order; `node_modules`, `dist`, `build`, `.git`, `coverage`, `.vetwo`, `generated/` ignored)
2. **Normalize** — frontmatter (`title`, `description`, `order`, `date`, `author`, `kind`) plus headings, links, assets, and code
3. **Model** — routes, sections, one home page, blog posts with newest-first ordering, a synthesized `/blog` listing, navigation, search records
4. **Render** — the enabled output targets (Next.js, Markdown, static, Fumadocs site)
5. **Reconcile** — manifest inventory, stale-output cleanup, validation gate

Missing content fails loudly: no pages, titles, dates, or API entries are ever invented. Frontmatter rules (title fallback chain, strict calendar dates, `search: false` opt-out) are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Legacy Source Inference (Opt-In)

Setting `content: { pipeline: "legacy" }` (plus `api.enabled: true` for API reference) restores the historical inference-driven flow — project-knowledge building, API symbol extraction, dependency classification, framework detection, and example composition feeding the same renderers. The `analyze`, `plan`, `render`, and `content` command groups always use this tooling explicitly. This surface is supported but frozen; see [COMPATIBILITY.md](./COMPATIBILITY.md). It is not part of the default workflow and this guide does not document it as current behavior.

### Programmatic API

```ts
import { build, defineDocs, createLogger } from "@vetwo/docs";

const logger = createLogger();
await build({ rootDir: "/path/to/project", logger });
```

`defineDocs({...})` creates a frozen, fully-resolved configuration (single defaults boundary); `loadConfig(rootDir)` loads it from `docs.config.*` or the `package.json` `@vetwo/docs` key. Public types (`DocsConfig`, `DocsConfigInput`, `ThemeConfig`, `SearchConfig`, …) and the `intelligence`/`state` namespaces are exported from the package root and the documented subpaths (`@vetwo/docs/config`, `@vetwo/docs/api`, `@vetwo/docs/renderers`, …).

---

## Markdown Features

### Frontmatter

```yaml
---
title: Page Title        # default: first H1, else filename
description: Page description  # default: first paragraph as plain text
order: 1                # numeric page ordering within its section (default 0)
date: 2026-02-01        # blog posts: strict YYYY-MM-DD (invalid dates rejected)
author: Jane Doe        # optional byline passthrough
search: false           # opt out of the search index for this page
---
```

`blog/` pages also accept `kind: blog`; only the root `index.md` may be `kind: home` (exactly one home page).

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

MDX files (`.mdx`) support custom components. Components must be declared in configuration (`components: { Name: "./path/to/module" }`) and can be checked with `docs content validate --components '<json>'`. The renderers natively understand API blocks (`ApiSignature`, `ParameterTable`, `TypeDisplay`, …); unknown components are preserved as MDX in `.mdx` output, degraded to headings/tables/code in plain `.md` output, and replaced with an HTML comment in static output.

```mdx
# My Page

<NewsletterSignup />
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
      heading: "Inter, sans-serif",
      body: "Inter, sans-serif",
      code: "Fira Code, monospace",
    },
  },
});
```

### Dark Mode

Every built-in theme ships a dark variant (`dark` colors alongside the light ones); `DocsLayout` and `ThemeToggle` accept `"light" | "dark" | "system"`.

---

## React Integration

```tsx
import { DocsLayout, MarkdownRenderer, TOC, SearchBox } from "@vetwo/docs/react";

export default function Page({ html, headings }: { html: string; headings: { level: number; id: string; text: string }[] }) {
  return (
    <DocsLayout title="My Docs" theme="system">
      <SearchBox />
      <TOC headings={headings} />
      <MarkdownRenderer content={html} />
    </DocsLayout>
  );
}
```

### Available Components

- `DocsLayout` — page shell (`title`, `description`, `nav`, `sidebar`, `theme: "light" | "dark" | "system"`)
- `MarkdownRenderer` — renders pipeline HTML (`content`, `className?`)
- `TOC` — table of contents from headings (`headings`, `maxDepth?`)
- `ThemeToggle` — client-side light/dark button (`defaultTheme?`)
- `SearchBox` — search input (`searchUrl?`)

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
| `minisearch` | Default; index recorded in `search-index.json` |
| `pagefind` | Alternative engine value |

The static target additionally ships a self-contained search page (`search/`) with vanilla-JS ranking over the generated records — no runtime dependencies. Exclude a page with `search: false` frontmatter.

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

## API Documentation (legacy opt-in)

API reference from TypeScript sources is available through the legacy pipeline (`content.pipeline: "legacy"` with `api.enabled: true`), which extracts functions, classes, interfaces, types, and enums with JSDoc descriptions. It is not part of the default content-first workflow. See [COMPATIBILITY.md](./COMPATIBILITY.md).

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

Navigation metadata is derived from the canonical site model (sidebar tree, breadcrumbs, `meta.json` per content folder).

---

## Sidebar

Sidebar groups contain explicit item objects:

```ts
sidebar: {
  auto: false,
  collapsed: false,
  groups: [
    {
      title: "Getting Started",
      items: [
        { label: "Introduction", href: "/introduction" },
        { label: "Setup", href: "/setup" },
        { label: "Advanced", href: "/adv", badge: "New" },
      ],
    },
  ],
}
```

Items support `label`, `href`, nested `items`, `collapsed`, and `badge`. With `auto: true` (the default), navigation is derived from the discovered page structure instead.

---

## Caching

Build caching (`cache: true` in config, the default) keeps compiler state under `.vetwo/docs/compiler/`. The historical `.docs-cache/` directory is legacy: `docs clean` still removes it when present, but new state is written to `.vetwo/docs/`.

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
- `bun.lockb` → bun
- `package-lock.json` → npm

---

## Error Handling

### Error Classes

Specialized error hierarchy rooted at `DocsError` (`src/errors/classes.ts`):

| Class | Use Case |
|---|---|
| `DocsError` | Base class for all errors (carries `code` and optional `cause`) |
| `ConfigurationError` | Configuration issues |
| `ValidationError` | Validation errors |
| `BuildError` | Build pipeline failures |
| `PluginError` | Plugin failures |
| `ThemeError` | Theme failures |
| `RendererError` | Rendering failures |
| `MarkdownError` | Markdown processing errors |
| `SearchError` | Search failures (`PagefindError` for Pagefind) |
| `TypeDocError` | TypeDoc integration errors |
| `CacheError` | Cache failures |
| `CliError` | CLI failures |
| `InternalError` | Unexpected internal errors |

### Error Codes

35 structured `DOCS_*` error codes (`src/errors/codes.ts`) for programmatic handling, plus numeric CLI exit codes (`EXIT_CODES`: 0 success, 1 general, 2 configuration, 3 build, 4 internal, 5 conflict, 6 validation, 130 interrupted). Thrown `DocsError` instances carry the machine-readable code on `.code`:

```ts
try {
  await build({ rootDir: ".", logger });
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "DOCS_CONFIG_INVALID") {
    // Handle invalid config
  }
  throw error;
}
```

A failed build propagates its error and exits nonzero — validation failures are never downgraded to warnings. See [SAFETY.md](./SAFETY.md) for the full guarantee list.

---

## Architecture

`@vetwo/docs` is organised around one canonical content pipeline. Authored Markdown/MDX flows through discovery and normalization, the site model, the versioned Documentation IR, output planning, and target renderers into owned, reconciled output. The engine (`createDocsEngine()` → `initialize()` → `build()` → `dispose()`) orchestrates the lifecycle behind a service container; all CLI commands share one context helper for root/config/logger resolution.

```
authored *.md/*.mdx + assets
  → site discovery + normalization  (src/site/)
  → site model → IR adapter         (src/site/model.ts, src/site/adapters.ts)
  → output planning                 (src/renderers/output-plan.ts)
  → Fumadocs / static / Markdown / Next.js renderers
  → writers + manifest + reconcile + validate
```

The full module map, layer responsibilities, engine lifecycle, state layout, and the legacy compatibility boundary are documented in [ARCHITECTURE.md](./ARCHITECTURE.md). Safety guarantees live in [SAFETY.md](./SAFETY.md).

---

## Project Structure

```
packages/docs/ (“@vetwo/docs”, repo root for this package)
├── src/
│   ├── index.ts, react.ts           # published entry points (plus config/api/… subpaths)
│   ├── cli/                         # CLI entry point and command registration
│   ├── engine/                      # DocsEngine lifecycle, service container, materialization
│   ├── site/                        # canonical content pipeline (discovery → model → IR)
│   ├── renderers/                   # output planning + Fumadocs/static/Markdown/Next.js targets
│   ├── documentation/compiler/      # legacy inference pipeline + shared IR/manifest types
│   ├── config/                      # loading (loader), validation (Zod), defineDocs defaults
│   ├── scanner/                     # file & project discovery
│   ├── content/                     # authored-content inspection, MDX parsing, regeneration
│   ├── state/                       # namespaced engine state under .vetwo/docs/
│   ├── init/                        # plan/apply workspace bootstrap
│   ├── dev-server/                  # development server with live reload
│   ├── api/, intelligence/, ai/, incremental/, integrations/  # retained legacy tooling
│   ├── plugins/, themes/, hooks/    # plugin system, theme registry, lifecycle hooks
│   ├── renderer/, react.ts          # React bindings (DocsLayout, TOC, SearchBox, …)
│   ├── analyzer/, symbols/, references/, graph/, languages/, compiler/
│   │                                # language/symbol infrastructure (legacy path + contracts)
│   └── filesystem/, errors/, logger/, cache/, utils/, types/  # shared infrastructure
├── test/cwd-fallback.test.ts        # isolated cwd-sensitive engine test (own vitest config)
├── docs/                            # generated self-documentation (git-ignored output)
├── docs.config.ts                   # self-documentation config (explicit legacy pipeline)
├── skills/docs-bootstrap/          # agent skill: bootstrap docs in a new project
├── dist/                            # compiled output (ESM + CJS + DTS, via tsup)
├── package.json, tsconfig.json
└── *.md                             # hand-maintained docs (README, HOW_WORKS, CLI, SAFETY, …)
```
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

- Vitest as test runner; tests co-located with source (`*.test.ts`, plus `__tests__/` in places)
- `test/cwd-fallback.test.ts` runs in an isolated process via its own `vitest.cwd.config.ts`
- Behavior-level CLI tests mock the filesystem, HTTP layer, engine, and config loading
- End-to-end materialization tests build real fixtures in temp directories

### Key Test Files

| File | Tests |
|---|---|
| `src/site/materialize.test.ts` | canonical materialization, ownership, determinism, failure modes |
| `src/site/content-first.test.ts` | default-pipeline proofs, link matrix, retired-module regression |
| `src/renderers/experience.test.ts` | cross-target Home/Blog/Search/identity parity |
| `src/cli/index.test.ts` | CLI commands, flags, validation, exit behavior |
| `src/engine/docs-materialize.test.ts` | legacy-pipeline end-to-end (explicit opt-in) |
| `src/public-api.test.ts` + `src/packaging.test.ts` | public contract and export↔artifact alignment |

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

- Node.js 20+ (see `engines` in `package.json`)
- pnpm (the repo uses `pnpm-workspace.yaml`)

### Setup

```bash
git clone https://github.com/vetwo/docs.git
cd packages/docs
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

No CI workflow files are checked into this package (`ci.yml`, `test.yml`, and similar are not present). The documented pre-merge bar is the manual checklist below, enforced locally by the pre-commit hook (`lint-staged`: `eslint --fix` and `prettier --write` on `.ts` files).

### Git Hooks

Pre-commit hook runs `lint-staged` which executes:
- `eslint --fix` on `.ts` files
- `prettier --write` on `.ts` files

Pre-commit hook runs `lint-staged` which executes:
- `eslint --fix` on `.ts` files
- `prettier --write` on `.ts` files
