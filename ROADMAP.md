# Roadmap

This document outlines planned features and improvements for @vetwo/docs. Priority and timelines may change based on community feedback and available resources.

## Planned Features

### Themes

- Built-in theme system with dark and light mode support
- Theme configuration for colors, fonts, logos, and favicons
- CSS overrides for full customization
- Community theme marketplace for sharing and installing themes

### Live Reload Development Server

- WebSocket-based hot reload during development
- Instant preview of content changes in the browser
- Hot module replacement for MDX components
- Port and host configuration options

### MDX Components

- Built-in interactive component library (callouts, tabs, code playgrounds)
- Custom MDX component registration via configuration
- Component-level frontmatter for controlling layout and behavior
- Support for client-side hydration in interactive components

### Internationalization (i18n)

- Multi-language documentation support from a single content source
- Automatic translation routing with language-specific paths
- RTL layout support
- Integration with translation management platforms

### Documentation Versioning

- Version switcher UI for maintaining docs across releases
- Version-aware URL routing (`/v1/guide`, `/v2/guide`)
- Inherited content between versions with per-version overrides
- Integration with git tags for automatic version snapshots

## Under Consideration

- Full-text search with fuzzy matching and typo tolerance
- Inline code annotations for explaining code snippets
- Markdown diffing for changelog-style documentation
- Custom page layouts with drag-and-drop sections
- Analytics integration (Plausible, Umami, Google Analytics)
- Authentication-gated documentation sections
- PDF export of documentation pages

## Completed

- [x] Plugin system with lifecycle hooks
- [x] CLI with all core commands
- [x] Configuration loading and validation
- [x] Markdown processing with frontmatter
- [x] Search index generation
- [x] API documentation from TypeScript
- [x] SEO metadata and sitemap generation
- [x] RSS feed generation
- [x] Build caching
- [x] Monorepo detection and support
