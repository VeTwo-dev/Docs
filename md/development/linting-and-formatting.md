# Linting and Formatting

```bash
pnpm lint          # eslint src/
pnpm lint:fix      # autofix
pnpm format        # prettier --write "src/**/*.ts"
pnpm format:check  # verify only
```

ESLint covers `src/` (flat config, Prettier-compatible). Prettier formats TypeScript sources only — Markdown docs in `md/` and root `*.md` are hand-formatted (one H1 per page, fenced code blocks, relative links; verified by the corpus link/parse checks, not by Prettier). The pre-commit hook runs both on staged `.ts` files, so a clean `git status` plus passing `lint`/`format:check` is the bar before review.
