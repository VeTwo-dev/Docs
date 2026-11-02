# Configuration Failures

- **`Configuration validation failed:` with per-field lines**: the printed paths name the exact fields (wrong type, empty `title`, bad `baseUrl`, bad `markdown.extension`). Fix the config — unknown keys are the one thing that pass through silently by design.
- **Settings seem ignored**: precedence is CLI flags → config file → env → defaults. A `--port` won't change a config value it doesn't map to; env vars only cover logging/CI/color (see [Environment Variables](../cli/environment-variables.md)).
- **Config file not found**: discovery order is `--config` path → `docs.config.{ts,js,mjs,cjs}` → `package.json` key → defaults. `docs init` scaffolds the file.
- **`output` collides with `source`**: with `source: "./docs"` also set an explicit output directory — otherwise generated files land inside the source tree (and the next discovery pass may trip over them; `generated/` itself is always skipped, your other output is not automatically ignored — add it to `ignore` if co-located).
- **Reserved keys doing nothing** (`watch`, `clean`, `include`, `remarkPlugins`, `rehypePlugins`): accepted and defaulted, no runtime effect in 1.0.0. Use the CLI equivalents.
