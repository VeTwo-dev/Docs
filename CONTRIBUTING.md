# Contributing to @vetwo/docs

Thank you for your interest in contributing to @vetwo/docs. This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- Node.js 18 or later
- npm, pnpm, yarn, or Bun

### Getting Started

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/docs.git
   cd docs/packages/docs
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development build:

   ```bash
   npm run dev
   ```

## Available Scripts

| Script | Description |
|---|---|
| `npm run build` | Build the package for production |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Run ESLint on the source files |
| `npm run lint:fix` | Run ESLint with automatic fixes |
| `npm run format` | Format source files with Prettier |
| `npm run format:check` | Check formatting without modifying files |
| `npm run typecheck` | Run the TypeScript compiler for type checking |
| `npm run test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run coverage` | Run tests with code coverage |
| `npm run clean` | Remove build output and coverage reports |

## Development Workflow

1. Create a new branch from `main`:

   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes in the `src/` directory.

3. Run the linter and type checker:

   ```bash
   npm run lint
   npm run typecheck
   ```

4. Run the tests:

   ```bash
   npm run test
   ```

5. Commit your changes with a clear, descriptive message.

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. All CI checks must pass: lint, typecheck, tests, and build.
3. Add a changeset describing your change if it affects the public API or user-facing behavior:

   ```bash
   npx changeset
   ```

4. Open a pull request with a clear title and description of what the change does and why.
5. Link any related issues in the PR description.

A maintainer will review your PR. You may be asked to make changes before it is merged.

## Code Style

- The project uses **ESLint** for linting and **Prettier** for formatting.
- Configuration is in `eslint.config.js` and `.prettierrc`.
- TypeScript strict mode is enabled. Avoid using `any` unless absolutely necessary.
- Use `readonly` properties on interfaces where mutation is not expected.
- Follow the existing naming conventions:
  - Files and directories: `kebab-case`
  - Types and interfaces: `PascalCase`
  - Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
- Keep functions focused and small. Extract utility functions when appropriate.
- Do not add comments unless they explain non-obvious behavior.

## Testing

- Tests are written using **Vitest**.
- Place test files alongside the source files they test, using the `.test.ts` suffix.
- Aim for meaningful coverage of new features and bug fixes.
- Run `npm run coverage` to generate a coverage report before submitting.

## Project Structure

```
src/
  index.ts, react.ts      # Published entry points (plus config/api/… subpaths)
  cli/                    # CLI entry point and commands
  engine/                 # DocsEngine lifecycle, service container, materialization
  site/                   # Canonical content pipeline (discovery → model → IR)
  renderers/              # Output planning + Fumadocs/static/Markdown/Next.js targets
  documentation/compiler/ # Legacy inference pipeline + shared IR/manifest types
  config/                 # Loading, Zod validation, defineDocs defaults
  scanner/                # File and project discovery
  content/                # Authored-content inspection, MDX parsing, regeneration
  state/                  # Namespaced engine state under .vetwo/docs/
  init/                   # Plan/apply workspace bootstrap
  dev-server/             # Development server with live reload
  api/, intelligence/, ai/, incremental/, integrations/  # Retained legacy tooling
  plugins/, themes/, hooks/  # Plugin system, theme registry, lifecycle hooks
  analyzer/, symbols/, references/, graph/, languages/, compiler/
  filesystem/, errors/, logger/, cache/, utils/, types/  # Infrastructure
test/cwd-fallback.test.ts  # Isolated cwd-sensitive engine test
docs/                    # Generated self-documentation (git-ignored output)
skills/docs-bootstrap/   # Agent skill for bootstrapping docs
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module responsibilities and [HOW_WORKS.md](./HOW_WORKS.md) for the full guide.

## Reporting Issues

- Use the [Bug Report](https://github.com/vetwo/docs/issues/new?template=bug_report.md) template for bugs.
- Use the [Feature Request](https://github.com/vetwo/docs/issues/new?template=feature_request.md) template for new features.
- Check existing issues before opening a new one to avoid duplicates.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
