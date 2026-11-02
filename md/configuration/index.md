# Configuration

`@vetwo/docs` is configured in TypeScript (or via `package.json`), validated with Zod, and normalized once by `defineDocs` into a frozen object. Pages:

- [Files](files.md) — where configuration lives and how it is found.
- [Core Options](core-options.md) — identity, source, output, site chrome, Markdown, search.
- [Content Pipeline and Legacy Options](pipeline-and-legacy.md) — canonical vs legacy selection and the legacy-only keys.
- [Defaults and Precedence](defaults-and-precedence.md) — defaults, overrides, env, CLI precedence.
- [Examples](examples.md) — minimal, standard, and advanced configurations (all schema-valid).
