# Environment Variables

Every variable the CLI honors (all read from the process environment):

| Variable | Set by | Effect |
|---|---|---|
| `VETWO_LOG_LEVEL` | `--verbose` (`debug`), `--silent`/`--quiet`/`--ci` (`error`) | Logger verbosity threshold |
| `VETWO_CI` | `--ci` (`1`) | Non-interactive, deterministic behavior downstream |
| `NO_COLOR` | `--no-color` or the environment itself | Disables colored output (standard convention) |
| `FORCE_COLOR` | `--no-color` (`0`) | Forwards the no-color intent to chalk |

Notes: setting these directly has the same effect as the flags (flags overwrite with the same values). No secrets, tokens, API keys, or registry credentials are read from the environment by any command — provider configuration lives in config files, never env vars.
