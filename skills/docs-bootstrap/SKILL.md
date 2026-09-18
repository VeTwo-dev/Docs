---
name: docs-bootstrap
description: >
  Prepare a JavaScript/TypeScript project for documentation generation with
  @vetwo/docs. Use when a project has no docs setup yet, when `docs doctor`
  reports missing essentials, or before running `docs generate` for the first
  time. Audits package metadata, README, TypeScript config, exports, CLI and
  examples, then creates only the missing essential material.
---

# Docs Bootstrap

Make a JS/TS project ready for `@vetwo/docs` site generation. You produce the
**essential material** the generator needs — you do not write the documentation
itself (the generator does that deterministically from evidence).

## Prerequisites

- Node.js >= 20.
- `@vetwo/docs` installed (`npm i -D @vetwo/docs` or `pnpm add -D @vetwo/docs`).
- Work from the project root. Never invent APIs, commands, config fields, or
  URLs. Every file you create must reflect facts you verified in the repo.

## Workflow

### 1. Audit the project

Collect the following. Record what is missing — that list drives step 2.

| # | Material | Where to look | Why the generator needs it |
|---|----------|----------------|----------------------------|
| 1 | Package identity: `name`, `description`, `version`, `license`, `repository`, `homepage`, `bugs` | `package.json` | Site title, install commands, repo/npm links |
| 2 | Scripts: `build`, `test`, `dev`, `lint`, `typecheck`, release scripts | `package.json#scripts` | Development/testing/building/publishing pages |
| 3 | Package manager evidence | `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json` | Correct install commands |
| 4 | README: one-paragraph description + `##` feature headings | `README.md` | Project purpose, capabilities, audiences |
| 5 | TypeScript scope | `tsconfig.json` (`include` must cover source, must NOT cover `docs/`, `dist/`) | Semantic API analysis scope |
| 6 | Public exports with JSDoc (`@param`, `@returns`, `@example`) | `src/**/index.ts`, barrel files | API reference + quick-start + examples |
| 7 | CLI surface: `bin` entries + `.command("x").description("y")` chains | `package.json#bin`, `src/cli/**`, `bin/**` | CLI reference pages |
| 8 | Example sources | `examples/`, `README`, JSDoc `@example` tags | Examples page (real code, never invented) |
| 9 | Entry points / exports map | `package.json#main|module|types|exports` | Module grouping for API pages |

If `docs doctor` runs, treat its blocking failures as the audit result.

### 2. Generate only what is missing

Create files **only** for gaps found in step 1. Prefer editing existing files
over creating new ones. Never overwrite user content without asking.

**a. `docs.config.ts`** (create only if no `docs.config.*` exists):

```ts
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "<Package Display Name> — Documentation",
  description: "<one sentence from package.json/README>",
  source: "./src",
  output: {
    directory: "./docs",
    layout: { next: true, markdown: true, static: true },
  },
  api: {
    enabled: true,
    source: "./src",
    include: ["src/**/*.ts"],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"],
  },
});
```

**b. `package.json` metadata** — fill missing identity fields and scripts
only. Never change versions, dependencies, or behavior.

**c. `README.md`** — if missing or one line, add: a one-paragraph
description (from your audit, not invented) and `## Features` with items
backed by actual exports. Do not document APIs in prose here; that is the
generator's job.

**d. `tsconfig.json`** — ensure `include` covers source (e.g.
`["src/**/*.ts"]`) and excludes generated output (`docs`, `dist`).
A tsconfig without `include` makes the analyzer ingest its own output.

**e. JSDoc on public exports** — add `@param`/`@returns`/`@example` only to
exported functions/classes/types that lack them, using real names and types
read from the signatures. Never change code semantics.

**f. `.gitignore`** — ensure generated/build artifacts are ignored:

```text
docs/next/node_modules/
docs/next/.next/
docs/next/out/
.vetwo/
```

### 3. Validate the setup

Run in order; stop and fix before proceeding:

```bash
npx docs doctor          # expect: 0 blocking failures (advisories ok)
npx docs generate        # expect: "Materialized N files to ./docs/"
npx docs validate-output # expect: "Output valid"
```

If `generate` reports validation errors, read them literally — they name the
broken route, link, asset, or missing CSS integration. Fix the material, not
the generated files (never hand-edit `docs/` output to make validation pass).

### 4. Quality bar before handing off

- `docs/md/` contains one `.mdx` per planned page with frontmatter.
- `docs/next/` is a self-contained Next.js app (no imports from the source
  project), `docs/static/` works from any static server.
- No page is a metadata dump: titles render once, no `Examples / Examples`
  duplication, examples show real code.
- `docs doctor` exits 0.

## Anti-patterns (do not do these)

- Do not write documentation prose for APIs, CLI flags, or config fields —
  the generator produces those from semantic analysis.
- Do not invent examples, commands, environment variables, or URLs.
- Do not hand-edit anything under `docs/` to fix validation; fix the source
  material and regenerate.
- Do not commit `docs/next/node_modules`, `docs/next/.next`, or `docs/next/out`.
- Do not add project-specific special cases; everything here must work for an
  arbitrary JS/TS project.
