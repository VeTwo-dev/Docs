# Configuration Examples

All three pass the real Zod validation and `defineDocs` normalization.

## Minimal (content-first blog-less site)

```js
// docs.config.mjs
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Project",
  source: "./docs",
});
```

Defaults do the rest (canonical pipeline, `./docs` output, Markdown flavor). Note the defaults assume `source: "./src"`: content-first projects that keep sources in `./docs` should also set an explicit output directory so generated files never land inside the source tree.

## Explicit output (recommended when sources live in `./docs`)

```js
// docs.config.mjs
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Project",
  description: "Guides and reference",
  source: "./docs",
  output: {
    directory: "./out",
    layout: { markdown: true, static: true, site: true },
  },
  markdown: { extension: ".md" },
});
```

## Standard (blog, search, branding)

```js
// docs.config.mjs
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Project",
  description: "Guides and reference",
  source: "./docs",
  baseUrl: "https://myorg.github.io/myproject",
  output: { directory: "./out", layout: { markdown: true, static: true, site: true } },
  theme: { name: "custom", colors: { primary: "#3b82f6" } },
  nav: { items: [{ label: "Guide", href: "/guide" }] },
  search: { maxResults: 10 },
});
```

## Advanced (legacy API reference)

```js
// docs.config.mjs
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "My Library",
  source: "./docs",
  output: { directory: "./out", layout: { next: true, markdown: true, static: true } },
  content: { pipeline: "legacy" },
  api: { enabled: true, source: "./src", include: ["src/**/*.ts"] },
});
```

The advanced shape mirrors the repository's own `docs.config.ts` (explicit legacy opt-in for API material).
