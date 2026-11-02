# Configuration Files

## Discovery order

1. `--config <path>` when passed (resolved against the project root; settings load from that file's directory when it exists).
2. `docs.config.ts`, `docs.config.js`, `docs.config.mjs`, `docs.config.cjs` in the project root (first match wins).
3. The `package.json` `@vetwo/docs` key.
4. Built-in defaults.

`docs init` scaffolds `docs.config.ts`. `loadConfig` returns `{ config, filePath }` so tooling can report which file won.

## Formats

TypeScript (recommended), JavaScript (ESM or CommonJS) — all loaded with dynamic `import()`. Write configs as:

```ts
// docs.config.ts
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Project",
  source: "./docs",
});
```

`defineDocs` accepts a partial input, deep-merges it over defaults (explicitly provided arrays, including empty ones, always win), freezes the result, and is the only place defaults are applied. Validation (Zod) accepts the same partial shape with every field optional; unknown keys pass through; invalid shapes throw `Configuration validation failed:` with per-field messages.

## Path resolution

`source` and `output` are project-relative (resolved against the root, never the calling directory). `output` accepts a plain directory string or a full workspace object (`{ directory, layout: { next, markdown, static, site? } }` — a string means all layouts enabled).
