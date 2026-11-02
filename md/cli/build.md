# `docs build`

```text
docs build [-c|--config <path>] [--json]
```

Run the full engine (discovery, pipeline, materialization) and write all enabled output targets. Related: [generate](generate.md) (alias + regeneration), [doctor](doctor.md) (pre-flight checks).

## Behavior

- Loads config (`--config` path, else discovery), detects the project, discovers content, renders every enabled target, writes the manifest + search index, reconciles stale output, then runs the validation gate.
- Success exits 0 after validation passes. Any validation error (duplicate routes, invalid MDX, missing entry points, cross-renderer leaks) fails the build with a named message — failures are never downgraded to warnings.
- With `--json`, emits `{ success, duration, timestamp }` or an error object, exiting 3 on failure.

## Example

```bash
docs build
# ... Materialized N files to ./out/
```

Artifacts land under the configured output directory (default `./docs/`). Inspect them via [Static HTML Output](../guides/static-html-output.md) or serve with [serve](serve.md).

## Mistakes

- Building with no discoverable content (wrong `source`): fails loudly instead of emitting an empty site — fix `source`, don't hand-create output files.
- Shipping output from a failed (nonzero-exit) build.
