# Global Options

Flags accepted by every command (verified in `--help` output and the pre-action hook):

| Flag | Effect |
|---|---|
| `--config <path>` | Load this config file (resolved against the project root; when it exists, settings load from that file's directory) |
| `--verbose` | Debug logging (`VETWO_LOG_LEVEL=debug`) |
| `--silent`, `--quiet` | Errors only (`VETWO_LOG_LEVEL=error`) |
| `--ci` | CI mode: non-interactive, no spinners, deterministic output (`VETWO_CI=1`) |
| `--json` | Machine-readable output where the command supports it (`build`, `doctor`, `plan`, `coverage`, `validate-output`) |
| `--no-color` | Disable colors (`FORCE_COLOR=0`, `NO_COLOR=1`); the `NO_COLOR` env var alone also works |
| `--cwd <path>` | Run as if started in `<path>` for project-root discovery |
| `-V, --version` | Print the package version |
| `-h, --help` | Command or group help (append after any command) |

Scope notes: `--json` is honored only by commands that implement it — passing it elsewhere is silently ignored, not an error. `--config` selects the file but the project root still comes from `--cwd`/cwd walk. Option parsing itself never touches the filesystem.
