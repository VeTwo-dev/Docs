# Contributing

Conventions grounded in the repository as it exists (see also root `CONTRIBUTING.md` for conduct and PR process).

## Workflow

1. Branch, change, keep the existing architecture and coding conventions — no new frameworks for a fix.
2. Co-locate tests (`*.test.ts`, `__tests__/` fixtures where established); behavior-focused assertions, no weakened tests for green runs.
3. Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, focused suites, then the full `pnpm test` before review.
4. Document user-visible behavior changes in the affected `md/` page(s) and root docs in the same change — docs and code ship together.
5. Never commit secrets, registry tokens, or machine-specific absolute paths (in code, tests, fixtures, or docs).

## Boundaries contributors must respect

- No public export/subpath/CLI-flag/config-key removals or renames without an approved breaking-change decision.
- No weakening of filesystem, ownership, reconciliation, approval, or error guarantees.
- No new runtime dependencies without strict, evidenced need.
- Generated output (`docs/`, `dist/`, `coverage/`) is never committed; hand-maintained docs (`md/`, root `*.md`) never auto-generated.
- The legacy/intelligence surface stays frozen and supported; do not expand it, and do not wire it into the default path.
