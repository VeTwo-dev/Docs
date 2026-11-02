# CLI Reference

Complete reference for the `docs` command-line interface (also available as `vetwo-docs`). Every command, flag, and behavior below is implemented in `src/cli/index.ts` and the registered subcommand modules. See [HOW_WORKS.md](HOW_WORKS.md) for concepts and [SAFETY.md](SAFETY.md) for filesystem and process-safety guarantees.

## Global options

These flags apply to every command:

| Flag | Description |
|---|---|
| `--config <path>` | Load configuration from a custom file path (resolved against the project root) |
| `--verbose` | Enable debug logging (`VETWO_LOG_LEVEL=debug`) |
| `--silent`, `--quiet` | Errors only (`VETWO_LOG_LEVEL=error`) |
| `--ci` | CI mode: non-interactive, no spinners, deterministic output |
| `--json` | JSON output where the command supports it |
| `--no-color` | Disable colored output (also honors `NO_COLOR`) |
| `--cwd <path>` | Run as if started in `<path>`; selects the project root |

**Project-root precedence:** unless `--cwd` is given, commands use the current working directory, walking upward to the nearest directory containing `package.json`. An explicit `--config` path is resolved against that root.

## `docs init`

Initialize a documentation workspace. Safe and idempotent: existing user files are preserved via a plan/apply flow (create, skip, merge, warn, conflict — never destructive overwrite).

| Flag | Description |
|---|---|
| `--dry-run` | Show the planned actions without writing anything |
| `-y, --yes` | Apply only safe non-destructive actions without prompting |
| `--non-interactive` | Fail instead of prompting when confirmation is required |
| `-o, --output <directory>` | Documentation output directory (e.g. `wiki`) |

Typical output: `docs.config.ts`, `agent/skill.md` (when the agent workspace is enabled), output workspaces (`docs/md/`, `docs/next/`, `docs/static/` per layout), and a workspace manifest under `.vetwo/docs/manifests/`.

## `docs build`

Build documentation for production (runs the full engine: discovery, pipeline, and materialization).

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to config file |
| `--json` | Emit `{ success, duration, timestamp }` (or an error object with exit code 3 on failure) |

A failed build exits nonzero and never reports success: materialization/validation errors propagate instead of being downgraded to warnings.

## `docs generate`

Generate documentation (alias for `build`, plus an optional content-regeneration step).

| Flag | Description |
|---|---|
| `--dry-run` | Plan safe content regeneration without writing files |
| `--force` | Update manually-edited generated pages (never protected ones) |

Without flags, `generate` behaves like `build`.

## `docs dev`

Start the development server with live reload. Performs an initial build, serves the configured output directory, and rebuilds (debounced) when watched files change.

| Flag | Default | Description |
|---|---|---|
| `-p, --port <n>` | `3000` | Port to listen on (must be 1–65535, else an actionable error) |
| `-H, --host <name>` | `localhost` | Host to bind to |
| `--open` | off | Open the built URL in a browser (launched without a shell) |

`dev` serves exactly what `build` produces (the resolved configured output directory).

## `docs watch`

Watch the configured source directory for changes and rebuild (300 ms debounce). Runs until stopped. Prints a best-effort content-health summary after the first build.

## `docs serve [dir]`

Serve an already-built directory over HTTP. Performs **no build and no writes** — if the directory does not exist, it exits with an error telling you to run `docs build` first.

| Flag | Default | Description |
|---|---|---|
| `-p, --port <n>` | `3000` | Port to listen on (must be 1–65535) |
| `--host <name>` | `localhost` | Host to bind to |

`[dir]`, when given, is resolved against the project root; otherwise the configured output directory is served. Request paths are contained inside the served directory (traversal → `403`), missing files → `404` page, malformed request URLs → `400`.

## `docs clean`

Remove the configured output directory plus regenerable internal state. Supports `--dry-run` to preview. Refuses with an actionable error if the configured output directory falls outside the project root.

| Flag | Description |
|---|---|
| `--cache` | Only clean cached build artifacts |
| `--temporary` | Only clean temporary state |
| `--reports` | Only clean reports and diagnostics |
| `--state` | Clean safe regenerable internal state (derived indexes, graphs) |
| `--dry-run` | Show what would be removed without deleting anything |

With no scope flag, cache, temporary, reports, and legacy state are all cleaned. Only registered state namespaces under `.vetwo/docs/` are ever candidates; manifests and user-owned files are never targeted.

## `docs doctor`

Run diagnostics: Node.js version, `package.json`, config file, source directory, README, CHANGELOG (advisory), TypeScript detection, Git (advisory), required dependencies, engine-state health, plus a best-effort legacy architecture/quality analysis (see [COMPATIBILITY.md](COMPATIBILITY.md)). Exits nonzero when blocking checks fail; use `--json` for machine-readable output.

## `docs upgrade`

Inspect `@vetwo/*` dependencies: `npm view <pkg> version` per package, report outdated ones. With `--check`, stop after reporting. Otherwise install `<pkg>@latest` for each using the detected package manager. Package names are validated before any shell command runs.

## `docs plugin` / `docs theme`

- `plugin list` — list installed `vetwo-plugin-*` / `@vetwo/plugin-*` packages.
- `plugin add <name> [--dev]` / `plugin remove <name>` — install/uninstall via the detected package manager.
- `theme list` — list built-in themes plus installed `vetwo-theme-*` / `@vetwo/theme-*` packages.
- `theme install <name>` — install a theme package.

`<name>` must be a valid npm package name; anything else is refused before execution.

## Analysis and content groups (legacy-compatible)

These commands use the retained inference/analysis tooling explicitly. They are supported, but they are **not** part of the default content-first workflow (see [COMPATIBILITY.md](COMPATIBILITY.md)):

- `docs plan`, `docs analyze`, `docs coverage`, `docs render`, `docs validate-output`, `docs diff` — project analysis, inferred architecture, coverage, IR rendering, workspace validation, architecture diffing.
- `docs content check|lint|validate|conflicts|diff [slug]` — authored-content inspection and validation.
- `docs changes|impact|update` — incremental change detection and targeted regeneration.
- `docs ai list|providers|use|info|capabilities|doctor|review` — AI provider management.
- `docs integrations list|plan|validate` — ecosystem integration planning.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General/command failure (default for command errors) |
| `2` | Configuration error |
| `3` | Build failure (notably `build --json`) |
| `4` | Internal error |
| `5` | Conflict |
| `6` | Validation failure |
| `130` | Interrupted |

`doctor` exits nonzero when blocking checks fail. Failing commands print an actionable `"<Command> failed: <reason>"` message.
