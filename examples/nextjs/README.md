# Example: Next.js Project

This example demonstrates how to use `@vetwo/docs` alongside a Next.js application.

## What this example shows

- Running `@vetwo/docs` as part of a Next.js project
- Separating documentation build from the Next.js build
- Configuring docs to output to a public-compatible directory

## Structure

```
nextjs/
  docs/
    index.md              # Documentation landing page
  docs.config.ts          # @vetwo/docs configuration
  package.json
```

## Getting started

```bash
npm install
```

### Build documentation

```bash
npx docs build
```

The docs site is generated in `docs-site/`. You can serve it statically or deploy it separately.

## Notes

This example keeps the `@vetwo/docs` configuration separate from the Next.js config. The documentation is built as a standalone static site. For Next.js-integrated docs (e.g., using MDX pages), consider building a custom integration.
