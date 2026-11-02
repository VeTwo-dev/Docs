# `docs init`

```text
docs init [--dry-run] [-y|--yes] [--non-interactive] [-o|--output <directory>]
```

Initialize a documentation workspace. Safe and idempotent: it plans before writing, and the plan vocabulary (`create`, `skip`, `merge`, `warn`, `conflict` plus ownership classification) contains no destructive action — user-authored content is only skipped, warned about, surfaced as conflict, or safe-merged.

## Effects

Creates (when missing): `docs.config.ts`, the design directory (`design/tokens.css`, `design/base.css`, `design/components.css`, `design/README.md`), agent skill workspace files, output workspaces per layout (`docs/md/`, `docs/next/`, `docs/static/` style directories), and a workspace manifest under `.vetwo/docs/manifests/`. Existing files are preserved; managed skill sections merge. The design sources are create-missing-only — existing files are never regenerated or overwritten (see [Design System](../concepts/design-system.md)).

## Examples

```bash
docs init --dry-run     # preview the plan, change nothing
docs init -y            # apply safe actions without prompting
```

## Mistakes

- Expecting `init` to author your pages: it scaffolds workspace and config — write the Markdown yourself (see [First Documentation Project](../getting-started/first-documentation-project.md)).
- Re-running to "fix" content: `init` skips what exists; edit sources and run `docs build`.

Related: [Configuration](../configuration/index.md), [doctor](doctor.md).
