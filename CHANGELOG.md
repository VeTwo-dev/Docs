# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-15

### Added

- Initial stable release
- CLI with `init`, `dev`, `watch`, `build`, `generate`, `clean`, `doctor`, and `upgrade` commands
- Configuration via `docs.config.ts`, `docs.config.js`, `docs.config.mjs`, or JSON/YAML formats
- Markdown and MDX processing with frontmatter support
- Automatic table of contents generation with configurable depth
- Full-text search index generation at build time
- API documentation generation from TypeScript source files
- Built-in plugins for OpenAPI and Mermaid support
- Plugin system with lifecycle hooks (`init`, `discover`, `config`, `load`, `transform`, `generate`, `output`, `done`, `error`)
- SEO metadata generation (Open Graph, Twitter Cards)
- Sitemap and robots.txt generation
- RSS feed generation
- Syntax highlighting powered by Shiki
- Project detection for monorepos, libraries, and applications
- Package manager detection (npm, pnpm, yarn, Bun)
- File watching with chokidar
- Content-based build caching
- Read time estimation for pages
- Automatic slug generation from file paths
- Navigation and sidebar generation from file structure
