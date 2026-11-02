# Safety and Filesystem Guarantees

What `@vetwo/docs` guarantees about your files — and the tested boundaries behind each guarantee. Every claim below names its implementation or test evidence. Anything not listed here (notably symlink handling) is **not** claimed.

## Generated-file ownership

Every file the generator writes is either tracked in `manifest.json` (under the workspace root, marked `_generatedBy: "@vetwo/docs"` with per-target inventories `files: { next, md, static, site, generated }`) or carries an ownership marker. Markdown/MDX artifacts carry a `generator: "@vetwo/docs"` frontmatter field, recognized by `isGeneratedContent`.

**Guarantee: the generator never silently overwrites user content.** On regeneration, files it owns are refreshed (even if hand-edited, when inventoried), user-owned files are preserved byte-for-byte, and unknown files are left alone.

## Stale-output reconciliation

When sources disappear, the next build removes only files the *previous* manifest proves the generator owned and that are no longer generated (`reconcilePreviousFiles`). A second sweep removes orphaned files that carry the generator header but appear in no inventory (`sweepOrphanedFiles`). Headerless unknown files are always preserved.

**Guarantee: repeated builds do not accumulate stale generated artifacts, and cleanup never deletes unknown or user-owned files.** Covered by determinism, stale-removal, and foreign-file preservation tests.

## Path containment

All output writes are bounded by their renderer root (`renderers/writer.ts` rejects any target outside it), and request/output paths are checked with `isPathWithinRoot` (`src/filesystem`), which uses path-relative semantics rather than string prefixes — so sibling directories that share a name prefix (e.g. `/srv/outside` vs `/srv/out`) can never match. This guard protects:

- `docs serve` and the dev server: request paths escaping the served directory get `403`.
- `docs clean`: an output directory outside the project root is refused with an actionable error instead of being deleted.
- State namespaces: registry ids (`plugin:<name>`, `ai:<provider>`) are sanitized so separators and dot-segments cannot map outside `.vetwo/docs/`.

**Guarantee: generated writes, served files, deletions, and state paths stay inside their configured roots.** Symlink behavior is **not** verified — containment checks are lexical; a symlink inside an allowed root pointing outside it is not specifically handled or tested.

## Safe `clean` behavior

`docs clean` removes the configured output directory and regenerable internal state only (see [CLI.md](CLI.md) for scope flags). Only *registered* state namespaces are candidates; the state manifest itself, workspace manifests, and user-owned directories are never targeted. `--dry-run` previews every removal.

## Child processes and shell safety

No CLI command interpolates untrusted input into a shell string unchecked:

- `plugin add/remove <name>`, `theme install <name>`, and `upgrade` validate package names against npm-name shape before any `execSync` call; unexpected names are refused (or skipped with a warning for dependency keys read from `package.json`).
- `dev --open` launches the browser via `execFile` with an argument array — the URL never passes through a shell.
- `doctor`'s Node-version probe uses a fixed command string.

**Guarantee: package names and host/port flags cannot inject shell commands** (tested with metacharacter inputs).

## Ports, roots, and malformed input

- `--port` values for `dev`/`serve` must be integers 1–65535; anything else fails fast with an actionable error instead of an obscure `listen` failure.
- Project-root resolution (`--cwd` > nearest `package.json` upward walk) is shared by all commands; build, discovery, pipeline output, and watch paths are all anchored at the resolved root, so running from a subdirectory cannot scatter files into the calling directory.
- Malformed HTTP request URLs in `serve` return `400` instead of crashing the server.

## `init` safeguards

`docs init` plans before it writes. Every planned path carries an action (`create`, `skip`, `merge`, `warn`, `conflict`) and an ownership classification (`system-managed`, `system-generated`, `user-authored`, `user-modified-generated`, `unknown`). There is no destructive action in the vocabulary: user-authored content is only ever skipped, warned about, surfaced as a conflict, or safe-merged (managed skill sections). `--dry-run` previews the plan; `--non-interactive` fails instead of prompting.

## Error propagation and exit codes

Validation failures (duplicate routes, invalid MDX, missing entry points, cross-renderer leaks) fail the build with `DOCS_*` error codes (`src/errors/codes.ts`); a failed materialization fails `docs build` rather than reporting success. CLI exit codes: `0` success, `1` general failure, `2` configuration, `3` build (`--json`), `4` internal, `5` conflict, `6` validation, `130` interrupted. `doctor` exits nonzero when blocking checks fail.

## What is intentionally *not* guaranteed

- Symlink-aware containment (see above).
- Protection against a user explicitly configuring an output directory they then delete via other tools.
- The legacy inference pipeline's notion of "no invented content" — the canonical pipeline never invents titles, dates, API entries, or examples (invalid dates are rejected, missing content fails loudly); legacy inference behavior is described in [COMPATIBILITY.md](COMPATIBILITY.md).
