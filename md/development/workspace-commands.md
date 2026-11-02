# Workspace Commands

Every script from `package.json`, with what it checks:

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsup` | Production bundles (ESM + CJS + DTS + sourcemaps) into `dist/` |
| `dev` | `tsup --watch` | Recompile on change (package development, not docs serving) |
| `lint` / `lint:fix` | `eslint src/` | Lint (optionally autofix) |
| `format` / `format:check` | `prettier --write/--check "src/**/*.ts"` | Format TypeScript sources |
| `typecheck` | `tsc --noEmit` | Full type check (tests excluded by `tsconfig`) |
| `test` / `test:watch` | `vitest run` / `vitest` | Suite once / in watch mode |
| `coverage` | `vitest run --coverage` | Suite with V8 coverage report |
| `clean` | `rimraf dist coverage` | Remove build output and coverage |
| `docs:install` | `npm --prefix docs/site install` | One-time install of the generated Fumadocs/Next.js app's dependencies |
| `docs:generate` | `pnpm build && node ./dist/cli/index.js build` | Rebuild the CLI, then render `./md` → `docs/` (Markdown + static HTML + Fumadocs app) |
| `docs:dev` | `pnpm docs:generate && npm --prefix docs/site run dev` | Generate, then serve the Next.js/Fumadocs dev site |
| `docs:build` | `pnpm docs:generate && npm --prefix docs/site run build -- --webpack` | Generate, then production-build the Fumadocs site (static export under `docs/site/out`) |
| `docs:static:build` | `pnpm build && node ./dist/cli/index.js build --config docs.static.config.ts` | Render `./md` → `docs-static/` (portable static site at `docs-static/static/`) |
| `docs:verify` | `pnpm build && node ./dist/cli/index.js validate-output` | Validate the generated workspace (pages, routes, assets, renderer boundaries) |
| `prepublishOnly` | `npm run build` | Guarantee fresh `dist/` before publishing |
| `prepare` | `husky` | Install git hooks |

Note the `dev`/`clean` name overlap with the docs CLI: `pnpm dev` recompiles the *package*, while `pnpm docs:dev` serves *this documentation site*. Same idea for `clean`. The `docs:*` scripts are covered end to end in [Self-Hosting This Documentation](self-hosting.md).
