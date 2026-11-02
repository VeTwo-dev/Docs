# Development Setup

```bash
git clone https://github.com/vetwo/docs.git
cd packages/docs
pnpm install
```

Requires Node.js 20+ and pnpm (the repo uses `pnpm-workspace.yaml`). Husky installs a pre-commit hook (`lint-staged`: `eslint --fix` + `prettier --write` on staged `.ts` files).

## Layout recap

`src/` holds the implementation (see the [architecture](../architecture/overview.md) module map), `test/` the isolated cwd case, `docs/` the generated self-documentation (git-ignored), `skills/` the agent skill, `dist/` the compiled output. Hand-maintained docs live in root `*.md` plus this `md/` corpus; `docs/md/` is generated output — never edit it by hand.
