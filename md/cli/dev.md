# `docs dev`

```text
docs dev [-p|--port <n>] [-H|--host <name>] [--open]
```

Development loop: full initial build, serve the configured output directory, rebuild (debounced) on watched source changes with live-reload notification.

## Flags and defaults

- `--port` (default `3000`): must be an integer 1–65535, else an actionable error before anything starts.
- `--host` (default `localhost`).
- `--open`: open the URL in a browser (launched without a shell).

Serves exactly what `build` produces (the resolved configured output, default `<root>/docs`).

## Example

```bash
docs dev --port 8080
# Development server running at http://localhost:8080
```

Stop with Ctrl+C. For production output use [build](build.md); to serve without rebuilding use [serve](serve.md).

## Mistakes

- Expecting `dev` to serve a different directory than configured: set the output directory in config, don't move files after building.
