# Verification

Confirm the installation works before writing content.

## Version and help

```bash
node ./node_modules/@vetwo/docs/dist/cli/index.js --version
node ./node_modules/@vetwo/docs/dist/cli/index.js --help
```

Expect the installed version (`1.0.0`) and the full command list (init, dev, watch, build, generate, clean, doctor, serve, upgrade, plugin, theme, ai, plan, analyze, coverage, render, validate-output, diff, content, changes, impact, update, integrations). If `--help` fails, the install is incomplete — reinstall.

## Project diagnostics

From your project root:

```bash
npx docs doctor
```

`doctor` checks, in order: Node.js version, `package.json` presence, configuration file, source directory, README, CHANGELOG (advisory only), TypeScript detection (informational for content-first projects), Git (advisory), required runtime dependencies, engine-state health, and a best-effort legacy architecture analysis. Blocking failures exit nonzero; advisories only warn. `--json` emits machine-readable results.

## Common environment problems

- **`docs.config.*` not found**: expected before `docs init` — run `docs init` (or rely on `package.json` + defaults).
- **Source directory missing**: create the directory your `source` points at (default `./src`; content-first projects usually set `./docs`).
- **Node.js too old**: `engines` requires 20+; upgrade Node.
- **TypeScript not detected**: fine unless you use the legacy inference pipeline — the default workflow never needs TypeScript sources.
- **Peer warnings for react/next**: only relevant if you build Fumadocs/Next.js output or use `@vetwo/docs/react`; otherwise ignorable.
