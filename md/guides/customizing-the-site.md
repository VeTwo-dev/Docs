# Customizing the Site

Supported extension points: themes, site chrome, navigation input, Markdown flavor, components, and plugins.

## Themes

Built-in themes: `default`, `midnight`, `forest` — each ships light and dark variants:

```js
export default defineDocs({ theme: "midnight" });
```

Or inline custom tokens (verified keys only):

```js
export default defineDocs({
  theme: {
    name: "custom",
    colors: { primary: "#3b82f6", background: "#ffffff", text: "#1f2937" },
    fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif", code: "Fira Code, monospace" },
    logo: "./assets/logo.svg",
  },
});
```

Both site targets emit CSS from one shared token module, so identity stays consistent. Manage theme packages with `docs theme list` / `docs theme install <name>` (names must be valid npm package names).

## Site chrome and identity

- `title` / `description`: site name, headings, metadata.
- `nav.items`: explicit top-bar links (`{ label, href }`, one nesting level).
- `sidebar`: `{ auto: true }` derives navigation from content; or explicit `groups: [{ title, items: [{ label, href }] }]`.
- `baseUrl`: sitemap and canonical links.
- Package identity (`repository`, `homepage`, `bugs`, package `name`) feeds GitHub/npm/issues links automatically when config navigation does not override them.

## Markdown flavor

```js
export default defineDocs({
  markdown: { gfm: true, toc: true, tocDepth: 3, syntaxHighlighting: true, extension: ".mdx" },
});
```

Set `markdown.extension: ".md"` for plain-Markdown `md/` output (custom blocks degrade; see [MDX Content](mdx-content.md)). Blog directory, ignore patterns, and search fields are covered in [Configuration](../configuration/index.md).

## Components and plugins

- `components: { Name: "./path/to/module" }` declares MDX components; check them with `docs content validate --components '<json>'`.
- `plugins: [openApi({ spec: "./openapi.json" }), mermaid()]` registers lifecycle plugins (`Plugin` type: `name`, `version`, `hooks` over init/discover/config/load/transform/generate/output/done/error with `{ ctx, config, log }`).
- React: `DocsLayout`, `MarkdownRenderer`, `TOC`, `ThemeToggle`, `SearchBox` from `@vetwo/docs/react` (see [React Components](../api/react.md)).

## What is not customizable

Output directory names per target (`next/`, `md/`, `static/`, `site/`, `generated/`), manifest shape, ownership markers, and route derivation are fixed contracts — customization happens in content, tokens, and components, not in the pipeline's outputs.
