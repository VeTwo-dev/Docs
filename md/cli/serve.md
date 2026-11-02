# `docs serve`

```text
docs serve [options] [dir]
```

Serve an already-built directory over HTTP. Performs **no build and no writes**.

## Flags and arguments

- `[dir]`: directory to serve, resolved against the project root. Omitted: the configured output directory.
- `-p, --port <n>` (default `3000`): integer 1–65535, else an actionable error.
- `--host <name>` (default `localhost`).

## Behavior

- Missing directory: exits with an error telling you to run `docs build` first.
- Directory requests resolve `index.html`; correct MIME types per extension; unknown extensions served as `application/octet-stream`.
- Request paths are contained: escapes get `403`, missing files get a `404` page, malformed URLs get `400`.
- No MIME table entry is invented per request; the table is fixed in the implementation.

## Example

```bash
docs build && docs serve --port 8080 ./out
# Serving /proj/out
#   Local: http://localhost:8080
```

Related: [dev](dev.md) (build + serve + watch), [Static HTML Output](../guides/static-html-output.md), [deployment](../guides/deployment.md).
