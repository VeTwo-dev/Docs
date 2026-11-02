# Public API

Programmatic surface of the package. Names and signatures verified against the shipped declarations (`dist/*.d.ts`).

- [Programmatic Build](programmatic-build.md): `defineDocs`, `loadConfig`, `build`, `createLogger`.
- [Plugins](plugins.md): registry, built-in plugins, hooks, authoring a plugin.
- [React Components](react.md): the `@vetwo/docs/react` subpath.
- [Errors](errors.md): error classes, codes, handling patterns.
- [Compatibility](compatibility.md): legacy APIs and guarantees.
- [Configuration Types](../configuration/core-options.md): full option reference.

Rule of thumb: root exports plus the 16 documented subpaths (`./cli`, `./config`, `./api`, `./plugins`, `./languages`, `./examples`, `./documentation-relations`, `./intelligence`, `./react`, `./ai`, `./documentation-compiler`, `./renderers`, `./incremental`, `./content`, `./state`, `./package.json`) are the supported surface. Anything else is internal regardless of where its source file lives.
