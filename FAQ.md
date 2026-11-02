# Frequently Asked Questions

## General

### What is @vetwo/docs?

@vetwo/docs is a documentation generator for JavaScript and TypeScript projects. It converts your authored Markdown and MDX files into documentation websites — a Next.js + Fumadocs site as the primary target and portable static HTML as the secondary target — with built-in search, navigation, Blog support, and safe generated-file ownership. API reference inferred from TypeScript sources is available separately as an explicit legacy opt-in (see [COMPATIBILITY.md](./COMPATIBILITY.md)).

### What Node.js versions are supported?

Node.js 20 or later is required (`engines` in `package.json`). We recommend using the latest LTS release.

### What file formats are supported for content?

@vetwo/docs supports `.md` (Markdown) and `.mdx` (MDX) files. Both formats support YAML frontmatter for page metadata.

## Configuration

### Where should I put my configuration file?

Place a `docs.config.ts` in the root of your project (also recognized: `docs.config.js`, `docs.config.mjs`, `docs.config.cjs`). Without a config file, settings fall back to the `@vetwo/docs` key in `package.json`, then to built-in defaults. Run `docs init` to scaffold a configuration file.

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
        items: [
          { label: "Getting Started", href: "/getting-started" },
          { label: "Installation", href: "/installation" },
        ],
      },
    ],
    collapsed: false,
  },
});
```

Set `auto: true` to derive navigation from your file structure. (Sidebar items are `{ label, href }` objects, optionally with `items`, `collapsed`, and `badge`.)

## Build

### Why is my build slow?

Common causes of slow builds:

- Large numbers of Markdown files (thousands of pages)
- Very large individual files (megabytes of content)
- API inference enabled on a large codebase (`api.enabled: true` with the legacy pipeline)

Try `cache: true` (the default) in your configuration, and use `ignore` patterns to exclude unnecessary directories.

### How do I exclude files from the build?

Use the `ignore` option in your configuration (merged over the built-in defaults):

```ts
export default defineDocs({
  ignore: ["test", "**/*.draft.md"],
});
```

### How do I regenerate only changed files?

Use `docs watch`, which monitors your source directory and rebuilds when files change. For CI, use `docs build`, which always does a full build. (Rebuilds are full builds; per-file incremental regeneration lives in the legacy `changes`/`impact`/`update` tooling.)

## API Documentation (legacy opt-in)

API reference from TypeScript sources requires the legacy pipeline. Set both `content.pipeline` and `api.enabled`:

```ts
export default defineDocs({
  content: { pipeline: "legacy" },
  api: {
    enabled: true,
    source: "./src",
    include: ["src/**/*.ts"],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
  },
});
```

### Does @vetwo/docs support JSDoc comments?

Yes — with the legacy pipeline above, the API tooling reads JSDoc comments from your TypeScript source files and includes them in the generated reference. The default content-first workflow renders authored Markdown only and never reads JSDoc. See [COMPATIBILITY.md](./COMPATIBILITY.md).

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

After running `docs build`, the configured output directory (default `./docs/`, or the workspace layout you configured) contains the targets you enabled. Serve the `static/` output (or the whole workspace) from any static host:

- **GitHub Pages / Netlify / Cloudflare Pages / Vercel**: publish the built output directory and set the build command to `npx docs build`

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
- **Source directory missing**: Create the configured source directory and add your Markdown files.
- **Node.js version too low**: Upgrade to Node.js 20 or later.
- **TypeScript not detected**: advisory for content-first projects — only the legacy inference path needs TypeScript sources.

### The build fails with a type error

Run `npx docs build --config ./docs.config.ts` to verify the config file path. Ensure your configuration file uses valid TypeScript and the correct import path:

```ts
import { defineDocs } from "@vetwo/docs";
```

If using JavaScript, use the `defineDocs` export from `@vetwo/docs/config` instead.

### The build fails with `Static: index.html missing`

The static target needs an entry point. With the default pipeline this means your content has no home page: add a root `index.md` (route `/`) under the configured `source` directory, or disable the `static` layout. A single page also works — it becomes the home page automatically.

### The build fails with `Duplicate route "..."`

Two source files claim the same URL (e.g. `guide.md` and `guide/index.md`, or `a.md` and `a.mdx`). Rename one so every file has a unique route.

### The build fails with `Invalid MDX ...`

The named `.mdx` file contains malformed JSX or unclosed expressions. Fix the markup in the source file and rebuild — generated files are never the place to fix this.

### `docs clean` refuses with "outside the project root"

Your configured `output` directory resolves outside the project. `clean` is destructive, so it fails instead of deleting there. Point `output` inside the project (or pass an explicit in-project directory) and retry — preview with `--dry-run`.

### `docs serve` rejects `--port`, or install commands refuse a name

Ports must be integers 1–65535. Plugin/theme names must be valid npm package names — shell metacharacters are refused before anything executes. Both fail fast with the reason printed; nothing is partially applied.
