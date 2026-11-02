# Building and Packaging

```bash
pnpm build     # tsup → dist/ (ESM + CJS + .d.ts + sourcemaps, minify off)
pnpm clean     # rimraf dist coverage
```

## What the build produces

Per package subpath, three artifacts: ESM (`.js`), CommonJS (`.cjs`/`.cts`), and declarations (`.d.ts`/`.d.cts`), e.g. `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, plus hashed shared chunks. Runtime third-party modules stay external (commander, zod, unified/remark/rehype, gray-matter, shiki, minisearch, …).

## Package validation (what CI-equivalent checks assert)

- Every `package.json` export subpath resolves to an existing `dist/` artifact.
- Every tsup entry is published via exports (no built-but-unreachable bundles, no exported-but-unbuilt subpaths).
- The public entry surface (`defineDocs`, `build`, scanners, compiler builtins, renderer factories, API facade, themes, CLI commands) resolves and behaves.
- Consumers: `import "@vetwo/docs"` (ESM) and `require("@vetwo/docs")` (CJS) both expose the root API; `@vetwo/docs/config` exposes `defineDocs`/`loadConfig`.

## Publishing facts

`files` ships `dist/`, `skills/`, `README.md`, `LICENSE`. `prepublishOnly` rebuilds so published artifacts always match source. Version `1.0.0`, MIT, `engines node >= 20`, optional peers `react`/`next` for the React/Fumadocs integrations.
