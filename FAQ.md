# Frequently Asked Questions

## General

### What is @vetwo/docs?

@vetwo/docs is a documentation generator for JavaScript and TypeScript projects. It converts Markdown and MDX files into a static documentation website with built-in search, SEO optimization, and API documentation generation.

### What Node.js versions are supported?

Node.js 18 or later is required. We recommend using the latest LTS release.

### What file formats are supported for content?

@vetwo/docs supports `.md` (Markdown) and `.mdx` (MDX) files. Both formats support YAML frontmatter for page metadata.

## Configuration

### Where should I put my configuration file?

Place a `docs.config.ts`, `docs.config.js`, or `docs.config.mjs` in the root of your project. You can also use `docs.config.json` or `docs.config.yaml`. Run `docs init` to create a default configuration file.

### Can I use a configuration file in a monorepo?

Yes. Place the configuration file in the root of the package you want to generate documentation for, or in the monorepo root. @vetwo/docs detects monorepo setups automatically.

### How do I customize the sidebar navigation?

Use the `sidebar` option in your configuration file:

```ts
export default defineDocs({
  sidebar: {
    auto: false,
    groups: [
      {
        title: "Getting Started",
        items: ["getting-started", "installation", "quickstart"],
      },
    ],
    collapsed: false,
  },
});
```

Set `auto: true` to generate the sidebar automatically from your file structure.

## Build

### Why is my build slow?

Common causes of slow builds:

- Large numbers of Markdown files (thousands of pages)
- Very large individual files (megabytes of content)
- Enabled API documentation generation on a large codebase

Try enabling caching with `cache: true` in your configuration, and use `ignore` patterns to exclude unnecessary directories.

### How do I exclude files from the build?

Use the `ignore` option in your configuration:

```ts
export default defineDocs({
  ignore: ["node_modules", "dist", "test", "**/*.draft.md"],
});
```

### How do I regenerate only changed files?

Use the `docs watch` command, which monitors your source directory and rebuilds only when files change. For CI, use `docs build` which always does a full build.

## API Documentation

### How do I enable API documentation?

Set `api.enabled` to `true` in your configuration and specify the source directory:

```ts
export default defineDocs({
  api: {
    enabled: true,
    source: "./src",
    include: ["*.ts"],
    exclude: ["*.test.ts", "*.spec.ts"],
  },
});
```

### Does @vetwo/docs support JSDoc comments?

Yes. The API documentation generator reads JSDoc comments from your TypeScript source files and includes them in the generated output.

## Search

### How does the search index work?

@vetwo/docs generates a search index at build time containing the title and content of each page. The index is stored as a JSON file and is loaded client-side for instant search with no server required.

### Can I disable search?

Set `search.enabled` to `false` in your configuration:

```ts
export default defineDocs({
  search: {
    enabled: false,
  },
});
```

## Deployment

### How do I deploy my documentation?

After running `docs build`, the `docs-site/` directory contains static files that can be hosted on any static hosting platform:

- **GitHub Pages**: Push the `docs-site/` directory to a `gh-pages` branch
- **Vercel**: Set the output directory to `docs-site` in your project settings
- **Netlify**: Set the publish directory to `docs-site` and the build command to `npx docs build`
- **Cloudflare Pages**: Set the output directory to `docs-site`

### How do I set the base URL for deployment?

Use the `baseUrl` option in your configuration:

```ts
export default defineDocs({
  baseUrl: "https://myorg.github.io/myproject",
});
```

## Troubleshooting

### `docs doctor` shows a failing check

Run `npx docs doctor` to diagnose issues. Common fixes:

- **Config not found**: Run `docs init` to create a configuration file.
- **Source directory missing**: Create a `docs/` directory and add your Markdown files.
- **Node.js version too low**: Upgrade to Node.js 18 or later.

### The build fails with a type error

Run `npx docs build --config ./docs.config.ts` to verify the config file path. Ensure your configuration file uses valid TypeScript and the correct import path:

```ts
import { defineDocs } from "@vetwo/docs";
```

If using JavaScript, use the `defineDocs` export from `@vetwo/docs/config` instead.
