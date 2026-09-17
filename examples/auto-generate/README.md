# Auto-Generate Example

This example demonstrates `docs generate` — the automatic documentation source generator.

## What it does

Running `docs generate` analyzes the project structure and automatically creates documentation pages:

- **Overview** — project name, version, description, scripts, tech stack
- **Architecture** — directory tree, config files, source file distribution
- **Getting Started** — installation guide based on detected package manager
- **Configuration** — all config files with type categorization
- **CLI Reference** — available npm scripts with descriptions
- **FAQ** — common questions for the detected project type
- **Troubleshooting** — common issues and solutions
- **Examples** — usage examples from the codebase

Plus metadata files: sidebar.json, navigation.json, search.json, api.json.

## Usage

```bash
# From the docs package root:
npx docs generate --config examples/auto-generate/docs.config.ts
```

## Configuration

The `docs.config.ts` enables the generator:

```ts
export default defineDocs({
  generator: {
    enabled: true,
    output: "./generated-docs",
    overwrite: false,
    api: true,
    architecture: true,
    guides: true,
    configuration: true,
    cli: true,
    faq: true,
    troubleshooting: true,
    examples: true,
  },
});
```

## Programmatic Usage

```ts
import { generateDocs, createLoggerSync } from "@vetwo/docs";

const result = await generateDocs({
  rootDir: ".",
  logger: createLoggerSync(),
  generatorConfig: { enabled: true, overwrite: true },
});

console.log(`Generated ${result.stats.totalPages} pages in ${result.stats.duration}ms`);
```
