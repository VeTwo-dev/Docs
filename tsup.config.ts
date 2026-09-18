import { defineConfig } from "tsup";

const runtimeExternals = [
  // CLI
  "commander",
  "ora",
  "chalk",
  // Config
  "zod",
  // Filesystem
  "chokidar",
  "fast-glob",
  "rimraf",
  // Markdown pipeline
  "unified",
  "remark-parse",
  "remark-gfm",
  "remark-frontmatter",
  "remark-rehype",
  "remark-directive",
  "remark-breaks",
  "remark-mdx",
  "remark-smartypants",
  "rehype-slug",
  "rehype-stringify",
  "rehype-autolink-headings",
  "rehype-pretty-code",
  "rehype-document",
  "rehype-raw",
  // Content
  "gray-matter",
  "reading-time",
  "github-slugger",
  "mdast-util-to-string",
  // Syntax highlighting
  "shiki",
  "@shikijs/transformers",
  // Search
  "minisearch",
  "pagefind",
  // RSS
  "feed",
  // Sitemap
  "sitemap",
  // OG images
  "satori",
  "@resvg/resvg-js",
  // API docs
  "typedoc",
  // Process execution
  "execa",
  "which-pm-runs",
  "detect-package-manager",
  // Utilities
  "defu",
  "pathe",
  "pkg-types",
  // Compiler layer (native compilers, loaded lazily)
  "typescript",
  "@babel/parser",
  // React (peer deps)
  "react",
  "react-dom",
  // Node built-ins
  "node:fs",
  "node:path",
  "node:url",
  "node:util",
  "node:worker_threads",
  "node:events",
  "node:crypto",
  "node:os",
  "node:child_process",
];

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      react: "src/react.ts",
      "cli/index": "src/cli/index.ts",
      "config/index": "src/config/index.ts",
      "api/index": "src/api/index.ts",
      "plugins/index": "src/plugins/index.ts",
      "languages/index": "src/languages/index.ts",
      "examples/index": "src/examples/index.ts",
      "documentation-relations/index": "src/documentation-relations/index.ts",
      "intelligence/index": "src/intelligence/index.ts",
      "state/index": "src/state/index.ts",
      "ai/index": "src/ai/index.ts",
      "documentation-compiler/index": "src/documentation/compiler/index.ts",
      "renderers/index": "src/renderers/index.ts",
      "content/index": "src/content/index.ts",
      "incremental/index": "src/incremental/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: "node20",
    outDir: "dist",
    external: runtimeExternals,
  },
]);
