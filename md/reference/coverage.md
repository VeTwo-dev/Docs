# Coverage Inventory

Machine-checkable map of product surface → documenting page → evidence. The Skill re-verifies this table on every synchronization pass.

## CLI (verified against live `--help` + command registration)

| Command / group | Page | Evidence |
|---|---|---|
| Global flags (`--config/--verbose/--silent/--quiet/--ci/--json/--no-color/--cwd/-V/-h`) | [options](../cli/options.md) | `top.txt` help harvest, pre-action hook |
| `init` (+4 flags) | [init](../cli/init.md) | `init.txt`, plan/apply implementation |
| `build` (`-c`, `--json`) | [build](../cli/build.md) | `build.txt`, engine + materialize |
| `generate` (`--dry-run`, `--force`) | [generate](../cli/generate.md) | `generate.txt`, regeneration flow |
| `dev` (`-p`, `-H`, `--open`) | [dev](../cli/dev.md) | `dev.txt`, dev-server wiring |
| `watch` (no flags) | [watch](../cli/watch.md) | `watch.txt`, chokidar wiring |
| `serve [dir]` (`-p`, `--host`) | [serve](../cli/serve.md) | `serve.txt`, handler + 403/404/400 |
| `clean` (5 flags) | [clean](../cli/clean.md) | `clean.txt`, containment guard |
| `doctor` (`--json`) | [doctor](../cli/doctor.md) | `doctor.txt`, ordered checks |
| `upgrade` (`--check`) | [upgrade](../cli/upgrade.md) | `upgrade.txt`, PM detection |
| `plugin` (list/add/remove) | [plugin](../cli/plugin.md) | `plugin.txt`, name validation |
| `theme` (list/install) | [theme](../cli/theme.md) | `theme.txt`, built-in set |
| `plan/analyze/coverage/render/validate-output/diff` | [analysis](../cli/analysis.md) | group helps, compiler CLI |
| `content` (check/lint/validate/conflicts/diff) | [content](../cli/content.md) | group + subcommand helps |
| `changes/impact/update` | [incremental](../cli/incremental.md) | top-level helps |
| `ai` (7 subcommands) | [ai](../cli/ai.md) | group help, registry |
| `integrations` (list/plan/validate) | [integrations](../cli/integrations.md) | group + subcommand helps |
| Env vars (4) | [environment-variables](../cli/environment-variables.md) | logger/global-options wiring |
| Exit codes (8) | [exit-codes](../cli/exit-codes.md) | `EXIT_CODES`, command exits |

## Configuration (verified against schema + live `defineDocs()` dump)

All `DocsConfig`/`DocsConfigInput` fields documented in [Core Options](../configuration/core-options.md) and [Pipeline and Legacy](../configuration/pipeline-and-legacy.md): identity/source/output/baseUrl/theme/nav/sidebar/seo/search/markdown/components/ignore (core), sitemap/robots/og/rss/versioning/monorepo/cache (artifacts), pipeline/content/api/architecture/ai/agent (legacy), reserved keys marked (`watch`, `clean`, `include`, `remarkPlugins`, `rehypePlugins`). Gaps: none known.

## Entry points (verified against `package.json` exports + `dist/*.d.ts`)

Root + 15 subpaths + `./package.json` (16 total) covered in [Public API](../api/index.md) and per-page references. Internal modules are intentionally undocumented as API.

## Workflows, targets, safety

Workflows: [Choose a Workflow](../getting-started/choose-a-workflow.md) (4 paths). Targets: Fumadocs/static/Markdown/Next.js + generated artifacts ([Rendering](../concepts/rendering-targets.md), guides). Safety invariants: ownership, containment, clean, processes, ports, init (each with a page + tests behind it).

## Unresolved items

None material. Minor: `docs.config.{json,yaml}` names exist in the loader's filename list but YAML/JSON module loading is unproven — documented as TypeScript/JavaScript-only.
