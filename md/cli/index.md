# CLI Overview

The `docs` binary (alias `vetwo-docs`) drives every workflow. Global behavior first, one page per command after.

## Discovery and precedence

- Commands run against a project root: `--cwd <path>` wins; otherwise the current directory, walking upward to the nearest `package.json`.
- `--config <path>` loads that file (resolved against the root); otherwise `docs.config.*`, then the `package.json` `@vetwo/docs` key, then built-in defaults.
- Global flags: `--config`, `--verbose`, `--silent`/`--quiet`, `--ci`, `--json` (where supported), `--no-color` (also `NO_COLOR`), `--cwd`, `-V/--version`, `-h/--help`.
- Logger verbosity follows `VETWO_LOG_LEVEL`; `--silent`/`--quiet`/`--ci` force error-only output.

## Exit codes

`0` success; `1` general/command failure; `2` configuration; `3` build failure (notably `build --json`); `4` internal; `5` conflict; `6` validation; `130` interrupted. `doctor` exits nonzero on blocking failures; advisories only warn. Details and per-command behavior: [Exit Codes](exit-codes.md).

## Command pages

- [init](init.md) · [build](build.md) · [generate](generate.md) · [dev](dev.md) · [watch](watch.md) · [serve](serve.md) · [clean](clean.md) · [doctor](doctor.md) · [upgrade](upgrade.md) · [plugin](plugin.md) · [theme](theme.md)
- Analysis (explicit inference): [analysis](analysis.md) (`plan`, `analyze`, `coverage`, `render`, `validate-output`, `diff`)
- Content tooling: [content](content.md) (`check`, `lint`, `validate`, `conflicts`, `diff`)
- Incremental: [incremental](incremental.md) (`changes`, `impact`, `update`)
- [ai](ai.md) · [integrations](integrations.md)
- Shared: [options](options.md), [environment variables](environment-variables.md), [exit codes](exit-codes.md)
