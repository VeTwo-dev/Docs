# Incremental Commands (Legacy Tooling)

```text
docs changes [--git <ref>]  # detected project changes since the last analysis
docs impact                 # documentation impact of current changes, before regenerating
docs update                 # incrementally regenerate only affected documentation
```

`changes --git <ref>` compares against a Git ref instead of the stored snapshot (the only command in this group that requires Git).

These commands belong to the retained incremental-analysis tooling. The default workflow rebuilds fully and deterministically (`build`, `watch`); per-file incremental output is not part of the canonical pipeline. See [Compatibility](../api/compatibility.md).
