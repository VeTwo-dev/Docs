# Filesystem Safety

Implementation-level account of every guarantee in the user-facing safety summary (kept in sync with it; do not duplicate prose claims here that lack code).

## Containment

- Renderer writes: target must equal or nest under the renderer root (separator-aware comparison) — enforced per file in the shared writer.
- Servers and `clean`: `isPathWithinRoot` (path-relative semantics, not string prefix) rejects sibling-prefix matches (`/srv/outside` vs `/srv/out`), parent escapes, and cross-drive absolutes.
- State namespaces: `plugin:`/`ai:` id segments are sanitized (separators and dot-segments neutralized) so ids can never map outside `.vetwo/docs/`.
- Scalar check: anything unresolved (malformed manifests, foreign markers) disables deletion rather than authorizing it.

## Ownership and reconciliation

Manifest inventory (`_generatedBy` gate) plus content markers (frontmatter `generator:`, code-file headers). Reconcile removes owned-but-absent files; orphan sweep removes headered-but-uninventoried files; unknown/headerless files are preserved. Same-root reruns are idempotent (deterministic output, no accumulation).

## Not implemented

Symlink-aware containment: checks are lexical. A symlink inside an allowed root pointing outside it is neither detected nor blocked. Do not claim otherwise in user docs.
