# `docs upgrade`

```text
docs upgrade [--check]
```

Inspect `@vetwo/*` (or `vetwo`) packages in your `dependencies`/`devDependencies`: report current vs registry versions per package. With `--check`, stop after reporting. Otherwise install `<pkg>@latest` for each via your detected package manager.

Package names are validated before any shell command runs; unexpected names are skipped with a warning.

## Example

```bash
docs upgrade --check
# Check complete (no changes made)
```

Staying within 1.x preserves all public contracts (see [Upgrading](../installation/upgrading.md)).
