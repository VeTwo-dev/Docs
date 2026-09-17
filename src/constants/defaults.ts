/** The package name for `@vetwo/docs`. */
export const PACKAGE_NAME = "@vetwo/docs" as const;

/** Recognised documentation configuration file names, in priority order. */
export const CONFIG_FILE_NAMES = [
  "docs.config.ts",
  "docs.config.js",
  "docs.config.mjs",
  "docs.config.cjs",
  "docs.config.yaml",
  "docs.config.yml",
  "docs.config.json",
] as const;

/** The default configuration file name used when none is explicitly provided. */
export const DEFAULT_CONFIG_FILE = "docs.config.ts" as const;

/** Default directory for source files. */
export const DEFAULT_SOURCE_DIR = "./src" as const;
/** Default directory for generated output files. */
export const DEFAULT_OUTPUT_DIR = "./docs" as const;

/** File extensions recognised as documentation (Markdown / MDX). */
export const MARKDOWN_EXTENSIONS = [".md", ".mdx"] as const;
/** File extensions recognised as source code for API extraction. */
export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;

/**
 * File name for the compiler cache manifest inside the `compiler` state
 * namespace (`.vetwo/docs/compiler/manifest.json`).
 */
export const CACHE_MANIFEST = "manifest.json" as const;

/** Default site title used when the user does not provide one. */
export const DEFAULT_TITLE = "Documentation" as const;
/** Default site description used when the user does not provide one. */
export const DEFAULT_DESCRIPTION = "Project documentation" as const;

/** Package managers recognised by the project detector. */
export const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

/** Glob patterns that are ignored by default during file discovery. */
export const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".turbo",
  "coverage",
  ".vetwo",
  ".docs-cache",
  "fixtures",
  "fixtures/**",
  "docs",
  "docs/**",
] as const;

/** The ordered list of lifecycle hook names the pipeline supports. */
export const LIFECYCLE_HOOKS = [
  "init",
  "discover",
  "config",
  "load",
  "transform",
  "generate",
  "output",
  "done",
  "error",
] as const;

/** Default heading text for the table of contents. */
export const DEFAULT_TOC_HEADING = "Table of Contents" as const;
/** Default file name for the search index. */
export const DEFAULT_SEARCH_INDEX_FILE = "search-index.json" as const;
/** Default file name for the sitemap. */
export const DEFAULT_SITEMAP_FILE = "sitemap.xml" as const;
/** Default file name for robots.txt. */
export const DEFAULT_ROBOTS_FILE = "robots.txt" as const;
/** Default file name for the RSS feed. */
export const DEFAULT_RSS_FILE = "feed.xml" as const;
