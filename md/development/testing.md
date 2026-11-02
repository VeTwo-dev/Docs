# Testing (Development)

Run `pnpm test` (`vitest run`) for the full suite; `pnpm test:watch` to iterate; `pnpm coverage` for the V8 report. TypeScript excludes `*.test.ts`/`*.spec.ts` from `tsc --noEmit`, so tests are type-loose by design — keep them behavior-focused.

## What to run when

- After touching renderers or the site model: the `src/site` + `src/renderers` suites, then the full run (cross-target parity is load-sensitive; rerun solo on timeouts).
- After touching the CLI: `src/cli/index.test.ts` (mocked fs/HTTP/engine — no real servers spawn).
- After touching config: config tests plus a live `defineDocs()` dump to eyeball defaults.
- After touching state/safety: state, filesystem, init planner, reconcile, and materialization suites.
- After touching docs under `md/`: the link/parse/coverage checks described in [Troubleshooting](../troubleshooting/index.md) (no test run needed for prose-only changes).

## Failure triage

Assertion with a named path/route → real defect or stale expectation (read it literally). Timeout only under full parallel load → rerun the file solo; several suites (nested-Vitest spawning, full-graph imports, whole-tree scans) are slow by construction. Process-spawning and timing-sensitive tests deserve suspicion before code does — but suspicion is not a verdict: reproduce solo, then decide.
