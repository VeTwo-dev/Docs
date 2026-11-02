# Exit Codes

Verified numeric contract (`EXIT_CODES` in the implementation):

| Code | Meaning | Seen when |
|---|---|---|
| `0` | Success | Command completed (including `doctor` with no blocking failures) |
| `1` | General/command failure | Any command error without a more specific code (invalid `--port`, refused names/paths, failed install, command exception) |
| `2` | Configuration | Invalid configuration |
| `3` | Build failure | Notably `build --json` on failure |
| `4` | Internal error | Unexpected internal failures |
| `5` | Conflict | Unresolved conflicts requiring a decision |
| `6` | Validation | Workspace/output validation failures |
| `130` | Interrupted | SIGINT-style termination |

`doctor` exits nonzero when blocking checks fail (advisories never fail it). A failed `build`/`generate` always exits nonzero with the validation message — success is never reported for invalid output. When scripting, prefer `--json` commands and branch on the exit code, not on log text.
