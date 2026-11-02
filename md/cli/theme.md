# `docs theme`

```text
docs theme list
docs theme install <name>
```

- `list`: shows built-in themes (`default`, `midnight`, `forest` — each with light and dark variants) plus installed `vetwo-theme-*` / `@vetwo/theme-*` packages.
- `install <name>`: installs the theme package as a devDependency via your package manager.

`<name>` must be a valid npm package name; anything else is refused before execution. For token-level customization without a package, see [Customizing the Site](../guides/customizing-the-site.md).
