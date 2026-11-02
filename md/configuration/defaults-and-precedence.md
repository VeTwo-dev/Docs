# Defaults and Precedence

## How defaults apply

Exactly once, inside `defineDocs`: user input deep-merges over the default object (explicit arrays, even empty ones, win outright), then the result is frozen. Validation happens before merging and never injects defaults — an invalid shape throws `Configuration validation failed:` with one line per field.

## Precedence, highest first

1. Explicit CLI flags (`--config`, `--port`, `--cwd`, …) — per-command, never global config writes.
2. The loaded config file (`--config` path, `docs.config.*`, or `package.json` key).
3. Environment: `--verbose/--silent/--ci/--no-color` map onto `VETWO_LOG_LEVEL`, `VETWO_CI`, `NO_COLOR`/`FORCE_COLOR` (see [Environment Variables](../cli/environment-variables.md)). No secrets or provider credentials come from the environment.
4. Built-in defaults (see [Core Options](core-options.md)).

## Unknown keys and invalid values

Unknown keys pass validation through untouched (`.passthrough()` schemas) so forward-compatible configs don't break. Wrong types, empty titles, bad `baseUrl`, or bad `markdown.extension` values throw with per-field messages — fix the config, don't hand-edit output.

## Path rules

`source`/`output` resolve against the project root. Discovery additionally ignores `node_modules`, `dist`, `build`, `.git`, `.turbo`, `coverage`, `.vetwo`, `.docs-cache`, and `fixtures` before your `ignore` list. The `generated/` directory is never treated as a content source.
