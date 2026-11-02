# `docs plugin`

```text
docs plugin list
docs plugin add [--dev] <name>
docs plugin remove <name>
```

- `list`: shows installed `vetwo-plugin-*` / `@vetwo/plugin-*` packages with versions (or reports none installed).
- `add <name>`: installs via your detected package manager (`--dev`, default true, installs as devDependency).
- `remove <name>`: uninstalls via your package manager (`pnpm remove`, `npm uninstall`, … as appropriate).

`<name>` must be a valid npm package name — shell metacharacters are refused before anything executes. For authoring a plugin (`name`, `version`, lifecycle hooks over init/discover/config/load/transform/generate/output/done/error), see [Plugins](../api/plugins.md).
