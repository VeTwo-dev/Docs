# Plugins

Lifecycle plugins (`Plugin`: `name`, `version`, `hooks`) via `createPluginRegistry`; built-ins `openApi({ spec })` and `mermaid()`; declared in config (`plugins: [...]`).

## Hook contract

Hooks run over init, discover, config, load, transform, generate, output, done, and error. Each receives `{ ctx, config, log }`: the mutable build context (pages, source files), the resolved config, and the logger.

```ts
import type { Plugin } from "@vetwo/docs";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  hooks: {
    init(ctx) {
      ctx.log.info("Plugin initialized");
    },
    transform(ctx) {
      for (const page of ctx.pages) {
        // Modify page content
      }
    },
  },
};
```

Manage installation with [`docs plugin`](../cli/plugin.md). Hook failures surface as plugin errors with the build failing loudly.
