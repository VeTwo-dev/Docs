# Example: Bun Project

This example demonstrates how to use `@vetwo/docs` in a Bun project.

## What this example shows

- Using `@vetwo/docs` with Bun as the runtime
- Minimal configuration for quick documentation generation
- Bun-native package manager integration

## Structure

```
bun-project/
  docs/
    index.md              # Landing page
  docs.config.ts          # @vetwo/docs configuration
  package.json
```

## Getting started

```bash
bun install
bunx docs build
```

## Running the dev server

```bash
bunx docs dev
```
