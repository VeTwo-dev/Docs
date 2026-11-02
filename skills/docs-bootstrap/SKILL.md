---
name: docs-bootstrap
description: >
  Prepare a JavaScript/TypeScript project for documentation generation with
  @vetwo/docs, and keep the docs site in sync with the project. Use when a
  project has no docs setup yet, when `docs doctor` reports missing essentials,
  when authoring or refreshing content under `docs/`, or before running
  `docs build` / `docs generate`. Mode A bootstraps essential material;
  Mode B synchronizes existing docs with implementation changes. Both modes
  audit first, create only what is missing, and never invent APIs, commands,
  or config fields.
---

# Docs Bootstrap

Two modes, one rule: **authored Markdown/MDX is the source of truth; the
generator renders it deterministically and invents nothing.**

- **Mode A — Bootstrap**: a project has no usable docs yet. Audit, then create
  only the missing essential material (config, home page, identity metadata).
- **Mode B — Synchronize**: docs exist. After implementation changes, find the
  drift between code and docs and correct the docs.

Default pipeline is `canonical` (content only). TypeScript inference runs only
when the project explicitly opts into `content: { pipeline: "legacy" }`.

## Prerequisites

- Node.js >= 20, `@vetwo/docs` installed as a dev dependency.
- Work from the project root. Never invent APIs, commands, flags, config
  fields, defaults, environment variables, or URLs. Every statement you write
  must be traceable to something you read in the repo (source, declarations,
  `--help`, or a real command run).
- Never modify generated output to make validation pass. Generated trees are
  derived; content is the fix location.

## Mode A — Bootstrap

### A1. Audit (record gaps, do not fix yet)

| # | Material | Where to look | Why it is needed |
|---|----------|----------------|------------------|
| 1 | Identity: `name`, `description`, `version`, `license`, `repository`, `homepage`, `bugs` | `package.json` | Site title, install commands, repo/npm links |
| 2 | Scripts: `build`, `test`, `dev`, `lint`, `typecheck`, release | `package.json#scripts` | Development/testing/building/publishing pages |
| 3 | Package manager evidence | `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json` | Correct install commands |
| 4 | README: one-paragraph description plus `##` headings | `README.md` | Purpose, capabilities, audiences |
| 5 | Authored content: `index.md` home page plus guides | `docs/` (or configured `source`) | The pages rendered; zero pages fails the build |
| 6 | Blog posts with `date: YYYY-MM-DD` | `docs/blog/` | Dated posts plus the synthesized `/blog` listing |
| 7 | CLI surface: `bin` entries + `.command(...).description(...)` | `package.json#bin`, `src/cli/**`, `bin/**` | CLI reference pages |
| 8 | Real examples | `examples/`, README code blocks, `@example` tags | Code quoted in guides — never invented |
| 9 | Entry points / exports map | `package.json#main|module|types|exports` | Module grouping for API pages |

If `docs doctor` runs, its blocking failures are part of the audit result.

### A2. Create only what is missing

Prefer editing an existing file over creating a new one. Never overwrite user
content without asking.

**a. `docs.config.ts`** — create only if no `docs.config.*` exists:

```ts
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "<Package Display Name> — Documentation",
  description: "<one sentence from package.json/README>",
  source: "./docs",
  output: {
    directory: "./out",
    layout: { next: true, markdown: true, static: true, site: true },
  },
});
```

Keep the output directory **outside** the content tree (`./out`, not `./docs`)
so generation never lands in the sources. Add
`content: { pipeline: "legacy" }` plus `api: { enabled: true, source: "./src", include: ["src/**/*.ts"] }`
only for projects that deliberately want source-inferred API reference.

**b. `package.json`** — fill missing identity fields and scripts only. Never
change versions, dependencies, or runtime behavior.

**c. `README.md`** — if absent or a single line, add a factual paragraph (from
the audit) and `## Features` items backed by real exports. Prose docs belong in
`docs/`, not the README.

**d. `docs/index.md`** — the home page. Without one, the `static` target fails
validation; with a single page, that page becomes home.

**e. `tsconfig.json`** — legacy opt-in only: `include` must cover sources and
exclude generated output.

**f. JSDoc** — legacy opt-in only: add `@param`/`@returns`/`@example` from real
signatures. Never change semantics. Skip for canonical projects.

**g. `.gitignore`** — generated app/build artifacts:

```text
docs/next/node_modules/
docs/next/.next/
docs/next/out/
.vetwo/
```

### A3. Validate Mode A

```bash
npx docs doctor          # 0 blocking failures (advisories are acceptable)
npx docs build           # or: npx docs generate
npx docs validate-output # success, exit 0
```

Read validation errors literally — they name the broken route, link, asset, or
missing CSS integration. Fix the material, regenerate.

## Mode B — Synchronize

Run after implementation changes (or when asked to refresh docs). Do not
rebuild the corpus from scratch; correct the drift.

### B1. Establish what changed

```bash
git diff --stat HEAD          # working tree vs last commit
git log --oneline -10         # recent intent
git diff HEAD -- 'src/**/*.ts' 'package.json'   # touched surface
```

Classify each change by surface: CLI (command/flag/exit), config (key/default),
public API (export/signature), behavior (pipeline/renderer/safety), tooling
(scripts/deps), docs-only.

### B2. Map change → affected pages

- New/renamed CLI command or flag → `docs/cli/<command>.md`, and the CLI index.
- Config key or default change → the configuration reference page.
- Export/signature change → the matching API page.
- Behavior or guarantee change → the matching concept, guide, or
  troubleshooting page.
- Only tooling changed → development/contributing pages.

### B3. Correct, don't accumulate

1. Edit the page whose claim is now false (or missing). Keep one page per
   topic; do not add near-duplicates.
2. Prefer editing an existing paragraph over appending a "changes" section —
   docs describe the current state, not a diff against themselves.
3. Update the navigation index if you added or removed a page.
4. If a behavior is genuinely unsupported, say so plainly; do not document an
   aspiration.

### B4. Validate Mode B

```bash
npx docs doctor
npx docs build
npx docs validate-output
```

Plus, for content-only changes: check every relative link in the changed pages
resolves to a real file, code fences parse, and no command/flag you wrote is
absent from `--help` (`npx docs <command> --help`).

## Operational checklist (both modes)

- [ ] No invented API, command, flag, default, env var, or URL — each traced
      to source, declarations, `--help`, or an executed command.
- [ ] Exactly one home page under `source`; no duplicate routes.
- [ ] Output directory explicit and outside the content tree (or ignored).
- [ ] Frontmatter dates quoted (`date: "2026-01-31"`).
- [ ] Internal links relative and existing; titles render once (single H1).
- [ ] Examples are real code copied from the project, not plausible-looking.
- [ ] `docs doctor` exits 0; `docs build` and `docs validate-output` succeed.
- [ ] Generated trees untouched by hand; nothing user-owned deleted.

## Anti-patterns

- Writing prose about APIs/flags/config and expecting the generator to infer
  them — author real content pages; nothing is auto-inferred on the canonical
  path.
- Silently enabling the legacy pipeline "because the project has TypeScript".
- Hand-editing generated output to satisfy validation.
- Rewriting an entire section during a Mode B sync instead of fixing the drift.
- Committing `docs/next/node_modules`, `.next`, or `out`.
- Project-specific special cases — every rule here must work for an arbitrary
  JS/TS project.