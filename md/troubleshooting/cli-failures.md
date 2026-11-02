# CLI Failures

- **`Invalid --port "…"`: ports must be integers 1–65535 (`dev`, `serve`). The failure happens before anything starts; nothing is partially applied.
- **Refused names/paths**: plugin/theme names must be valid npm package names; `clean` output must sit inside the project root. Both fail fast with the reason.
- **Wrong project built**: root resolution is `--cwd` → upward `package.json` walk from cwd. Running from a subdirectory builds the parent project — pass `--cwd` or `cd` explicitly.
- **`serve` says run `docs build` first**: the directory doesn't exist. `serve` never builds; that is the contract, not a bug.
- **400/403/404 from `serve`**: malformed URL / traversal attempt / missing file, respectively. 404s for `..`-style URLs are normal (paths normalize inside the root, then miss).
- **Nonzero exit with a `<Command> failed:` line**: read the reason after the colon — then the matching page in this section. `--json` commands (build, doctor, plan, coverage, validate-output) also emit the error object.
