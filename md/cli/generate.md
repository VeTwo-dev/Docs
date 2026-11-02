# `docs generate`

```text
docs generate [--dry-run] [--force]
```

Generate documentation. Without flags it behaves exactly like [build](build.md).

## Flags

- `--dry-run`: plan safe content regeneration without writing files; prints create/update/delete/preserve/conflict/review counts and exits before modifying anything.
- `--force`: update manually-edited generated pages (never protected ones), then build.

## Example

```bash
docs generate --dry-run
# Plan: 2 create, 0 update, 0 delete, 5 preserve, 0 conflict(s), 0 review
# Dry run complete — no files were modified
```

## Mistakes

- Expecting `generate` to invent missing pages: with the default pipeline it only regenerates from authored content (see [Authored Source of Truth](../concepts/authored-source-truth.md)).
- Hand-editing generated files to satisfy validation: fix the source material and regenerate (see [Ownership](../concepts/ownership-reconciliation.md)).
