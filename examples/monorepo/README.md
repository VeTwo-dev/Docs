# Example: Monorepo

This example demonstrates how to use `@vetwo/docs` in a monorepo workspace with multiple packages.

## What this example shows

- Configuring `@vetwo/docs` for a monorepo
- Documentation across multiple workspace packages
- Shared documentation configuration
- Per-package documentation directories

## Structure

```
monorepo/
  docs/                   # Root-level documentation
  packages/
    core/
      docs/               # Core package docs
      src/
        index.ts
      package.json
    utils/
      docs/               # Utils package docs
      src/
        index.ts
      package.json
  docs.config.ts          # Root @vetwo/docs config
  package.json            # Workspaces root
```

## Getting started

```bash
npm install
npx docs build
```

This will build documentation for all packages in the monorepo.
