# Testing

Layers the repository actually has (verified from the suite layout, not counts).

## Unit and contract tests

Co-located `*.test.ts` (plus `__tests__/` fixtures in places): normalizer rules (titles, dates, strict rejection), site model (ordering, listing synthesis, duplicates), adapters (provenance, references), renderers (parity, experience, boundaries), config (defaults, validation), CLI (mocked fs/HTTP/engine: flags, validation, exits), state/registry/filesystem (containment, sanitization, clean scoping).

## End-to-end tests

Real temp-directory builds asserting full output trees: canonical materialization (all targets, ownership, determinism, failure modes), legacy materialization (explicit opt-in), engine builds, init plans, and the public-API/packaging contracts (exports exist, every subpath resolves to a built artifact, every build entry is published).

## Isolation cases

`test/cwd-fallback.test.ts` runs in its own process via `vitest.cwd.config.ts` (spawns nested Vitest to prove `process.cwd()` fallback without polluting the parent runner). Skill frontmatter/workflow is pinned by its own test.

## Interpreting failures

- Assertion failure with a path/route named: real defect or stale expectation — read the message literally.
- Timeout under a full parallel run (especially import-heavy or process-spawning tests): re-run the file solo before concluding anything; several suites are load-sensitive by construction.
- Never delete or weaken a test to obtain green; fix the code or prove the expectation stale with implementation evidence.
