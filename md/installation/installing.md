# Installing

Install the published package with your package manager (requires registry access):

```bash
npm install @vetwo/docs --save-dev
pnpm add @vetwo/docs --save-dev
yarn add @vetwo/docs --dev
bun add @vetwo/docs --dev
```

This matches the project's own documented setup. The `docs` binary (alias `vetwo-docs`) becomes available via `npx docs ...`.

## Package contents

Version `1.0.0`, MIT licensed. The published files are the compiled `dist/` bundles (ESM + CommonJS + type declarations), the `skills/` directory, `README.md`, and `LICENSE`. Sixteen subpaths are exported — the root (config, build, plugins, scanners), `./cli`, `./config`, `./api`, `./plugins`, `./languages`, `./examples`, `./documentation-relations`, `./intelligence`, `./react`, `./ai`, `./documentation-compiler`, `./renderers`, `./incremental`, `./content`, `./state` — plus `./package.json`. See [Public API](../api/index.md).

## Workspace versus standalone

- **Standalone project**: install in the project, add `docs.config.ts`, write `docs/`, build.
- **Monorepo**: install where the docs live (package or root); the engine detects `pnpm-workspace.yaml`, `lerna.json`, or `package.json#workspaces`. Peer dependencies (`react >= 19`, `next >= 16.2.10`, both optional) matter only if you build or extend the React/Fumadocs outputs.

## Version selection

Pin the major version your automation was validated against. The legacy/intelligence surface is frozen for 1.x; any future removal would be a separately versioned major decision, never a silent patch change.
