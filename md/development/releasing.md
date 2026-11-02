# Releasing

Honest account of what release automation exists in-repo.

## Verified facts

- `package.json`: version `1.0.0`, MIT, `files: [dist, skills, README.md, LICENSE]`, `prepublishOnly: npm run build` (published artifacts always rebuilt from source).
- No release script, no changeset tooling, and no CI workflow files exist in this package — there is nothing to run beyond `pnpm build` + the validation below.
- Root `RELEASE.md` describes a changesets-based flow (add changeset → merge → version PR → verify, plus manual steps). That flow is documented convention, not installed automation: follow it only if the surrounding monorepo provides the tooling; do not claim CI runs it here.

## Pre-release checklist (all runnable here)

1. `pnpm typecheck`, `pnpm lint`, `prettier --check` clean.
2. `pnpm build` fresh; verify export subpaths resolve to `dist/` artifacts.
3. Full `pnpm test` green on a quiet tree (re-run solo anything that times out only under parallel load, and record it).
4. ESM + CJS smoke imports of the root entry; `--version`/`--help` smoke of the CLI.
5. `md/` corpus links/parse/coverage checks (see validation section of the docs skill).
6. Bump `version` deliberately; never silently change exports, remove surfaces, or add dependencies in a release commit.
