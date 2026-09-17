# Example: Library Project

This example demonstrates how to use `@vetwo/docs` in a simple library project.

## What this example shows

- Minimal `docs.config.ts` configuration for a library
- Organizing documentation into pages and guides
- Auto-generating API docs from source code JSDoc comments
- Custom nav and sidebar configuration

## Structure

```
library/
  docs/
    index.md              # Getting started page
    guides/
      installation.md     # Installation guide
      usage.md            # Usage guide
  src/
    index.ts              # Library source with JSDoc
  docs.config.ts          # @vetwo/docs configuration
  package.json
```

## Getting started

```bash
npm install
npx docs build
```

The generated documentation will be in the `docs-site/` directory.
