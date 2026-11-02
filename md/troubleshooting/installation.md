# Installation Failures

- **Wrong Node version**: `engines` requires 20+. `doctor` flags anything below 18.18. Upgrade Node; use the LTS.
- **Binary not found after install** (`docs: command not found`): the install didn't link `bin` (both `docs` and `vetwo-docs` ship). Reinstall; with pnpm check that `node_modules/.bin` is on your PATH when calling directly.
- **Peer warnings (react/next)**: needed only for Fumadocs/Next.js output or `@vetwo/docs/react`. Content-first static/Markdown sites ignore them safely.
- **Monorepo installs in the wrong package**: install where the docs live; the engine detects `pnpm-workspace.yaml`, `lerna.json`, or `package.json#workspaces`, but installation itself follows your package manager, not detection.
- **Registry access errors**: `upgrade`/`plugin`/`theme` installs and `npx`-fetched binaries need network. Pin versions and vendor tarballs for offline environments.
