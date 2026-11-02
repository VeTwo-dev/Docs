# Programmatic Build

```ts
import { build, defineDocs, createLogger } from "@vetwo/docs";
import { loadConfig } from "@vetwo/docs/config";

const logger = createLogger();
await build({ rootDir: "/path/to/project", logger });
```

## Functions

- `defineDocs(input?: DocsConfigInput): DocsConfig` — deep-merge partial input over defaults (explicit arrays win), freeze, return. The single defaults boundary; pure and synchronous.
- `loadConfig(rootDir: string): Promise<{ config, filePath }>` — discover (`--config` path, `docs.config.*`, `package.json` key, defaults), Zod-validate (throws `Configuration validation failed:` per-field), normalize via `defineDocs`.
- `build({ rootDir, configPath?, logger }): Promise<void>` — fresh engine per call: initialize (detect + load config + cache), discover, pipeline, materialize, dispose. Throws `DocsError` on materialization/validation failure.
- `createLogger()` / `createLoggerSync()` — console logger honoring `VETWO_LOG_LEVEL`/`VETWO_CI`/color env.

## Engine (advanced)

```ts
import { createDocsEngine } from "@vetwo/docs";

const engine = createDocsEngine({ rootDir, logger });
await engine.initialize();   // config + detection (idempotent)
await engine.build();        // full build
await engine.dispose();      // release; re-initializable after
```

`runPipeline`/`runGenerator`/`runAnalyzer`/`runScanner` execute subsystems standalone; `languages`/`compiler`/`symbols`/`references`/`graph` expose lazily-built managers. These serve the legacy/analysis workflows — canonical builds need only `build()`.

## Types

`DocsConfig`, `DocsConfigInput`, `ThemeConfig`, `NavConfig`, `SidebarConfig`, `SeoConfig`, `SearchConfig`, `VersioningConfig`, `MarkdownConfig`, `ApiConfig` (config); `BuildContext`, `Plugin`, `HookContext`, `FeatureGenerator`, `Logger` (engine); `SourceFile`, `DocPage`, `Heading`, `SearchEntry`, `ApiDocEntry`, and more (domain). Import types from the root or `@vetwo/docs/config`.
