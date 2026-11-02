# Core Options

Every field below exists in the validated schema with the stated default (dumped from a live `defineDocs({})` during documentation writing).

## Identity and source

| Field | Type | Default | Purpose |
|---|---|---|---|
| `title` | `string` | `"Documentation"` | Site name, headings, metadata |
| `description` | `string` | `"Project documentation"` | Meta description |
| `source` | `string` | `"./src"` | Content root for `*.md`/`*.mdx` (content-first projects set `"./docs"`) |
| `output` | `string \| OutputLayoutConfig` | `"./docs"` | Output dir, or workspace object (see [Files](files.md)) |
| `baseUrl` | `string` | `"/"` | Sitemap/canonical links (relative `/…` or `http(s)://…`) |

## Site chrome and content

| Field | Type | Default | Purpose |
|---|---|---|---|
| `theme` | `string \| ThemeConfig` | `"default"` | Theme name or inline tokens (`name`, `colors.*`, `fonts.*`, `logo`, `favicon`, `cssOverrides`). Values act as an override layer pinned on top of the [persistent design sources](../concepts/design-system.md) |
| `nav` | `NavConfig` | `undefined` | Top bar: `{ items: [{ label, href, items? }] }` |
| `sidebar` | `SidebarConfig` | `{ auto: true, groups: [], collapsed: false }` | Auto-derived nav or explicit `groups: [{ title, items: [{ label, href }] }]` |
| `seo` | `SeoConfig` | `{}` | `title`, `description`, `image`, `url`, `twitter` |
| `search` | `SearchConfig` | `{ enabled: true, engine: "minisearch", indexFields: ["title", "content", "category"], maxResults: 20 }` | `engine` is `"minisearch"` or `"pagefind"` |
| `markdown` | `MarkdownConfig` | `{ gfm: true, breaks: false, pedantic: false, headerIds: true, toc: true, tocDepth: 3, syntaxHighlighting: true, mdx: false, extension: ".mdx", … }` | GFM, TOC, highlighting, `.md`/`.mdx` output flavor |
| `components` | `Record<name, module>` | `{}` | Custom MDX component registry (checked by `content validate`) |
| `ignore` | `string[]` | built-in tooling list + yours | Discovery ignore globs |

## Output artifacts

| Field | Type | Default | Purpose |
|---|---|---|---|
| `sitemap` / `robots` / `og` | `boolean` | `true` / `true` / `true` | Sitemap/robots/OG artifacts (legacy pipeline outputs) |
| `rss` / `rssOptions` | `boolean` / `RssOptions` | `false` / `{}` | Feed artifact (legacy pipeline output) |
| `versioning` | `VersioningConfig` | `{ enabled: false, current: "latest", versions: [] }` | Multi-version metadata |
| `monorepo` | `boolean \| MonorepoConfig` | `false` | Workspace metadata |
| `cache` | `boolean` | `true` | Compiler/state caching under `.vetwo/` |

## Reserved keys (accepted, no runtime effect in 1.0.0)

`watch`, `clean`, `include`, `rehypePlugins`, `remarkPlugins` — validated and defaulted, but nothing reads them at runtime. Prefer the CLI equivalents (`docs watch`, `docs clean`). Their presence is a compatibility fact, not a roadmap promise.
