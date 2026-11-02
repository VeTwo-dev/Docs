# `docs watch`

```text
docs watch
```

Watch the configured source directory and rebuild on changes (300 ms debounce). Runs until stopped. Prints a best-effort content-health summary after the first build. No flags.

Rebuilds are full builds triggered by change events (`add`/`change`/`unlink`, dotfiles and `node_modules` ignored) — there is no per-file incremental output in the default workflow (see [incremental](incremental.md) for the legacy tooling).

Related: [dev](dev.md) (serve + watch combined), [build](build.md).
