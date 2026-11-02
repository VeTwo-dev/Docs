# `docs clean`

```text
docs clean [--cache] [--temporary] [--reports] [--state] [--dry-run]
```

Remove the configured output directory plus regenerable internal state. With no scope flag, cache, temporary, reports, and legacy state are cleaned (`--state` is off by default).

## Safety

- The output directory is resolved against the project root and **refused when it falls outside the root** — `clean` never deletes outside the project.
- `--dry-run` prints every removal (`Would remove ...`) without touching anything.
- Only *registered* state namespaces under `.vetwo/docs/` are candidates; the state manifest, workspace manifests, and user-owned directories are never targeted.

## Example

```bash
docs clean --dry-run
docs clean --cache
```

Related: [Ownership and Reconciliation](../concepts/ownership-reconciliation.md), [doctor](doctor.md).
