import { describe, it, expect } from "vitest";
import {
  PACKAGE_NAME,
  CONFIG_FILE_NAMES,
  DEFAULT_CONFIG_FILE,
  DEFAULT_SOURCE_DIR,
  DEFAULT_OUTPUT_DIR,
  MARKDOWN_EXTENSIONS,
  SOURCE_EXTENSIONS,
  CACHE_MANIFEST,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  SUPPORTED_PACKAGE_MANAGERS,
  DEFAULT_IGNORE_PATTERNS,
  LIFECYCLE_HOOKS,
  DEFAULT_TOC_HEADING,
  DEFAULT_SEARCH_INDEX_FILE,
  DEFAULT_SITEMAP_FILE,
  DEFAULT_ROBOTS_FILE,
  DEFAULT_RSS_FILE,
} from "./defaults.js";

describe("constants/defaults", () => {
  it("PACKAGE_NAME is @vetwo/docs", () => {
    expect(PACKAGE_NAME).toBe("@vetwo/docs");
  });

  it("CONFIG_FILE_NAMES includes all expected config file variants", () => {
    expect(CONFIG_FILE_NAMES).toContain("docs.config.ts");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.js");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.mjs");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.cjs");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.yaml");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.yml");
    expect(CONFIG_FILE_NAMES).toContain("docs.config.json");
    expect(CONFIG_FILE_NAMES.length).toBe(7);
  });

  it("DEFAULT_CONFIG_FILE is docs.config.ts", () => {
    expect(DEFAULT_CONFIG_FILE).toBe("docs.config.ts");
  });

  it("DEFAULT_SOURCE_DIR is ./src", () => {
    expect(DEFAULT_SOURCE_DIR).toBe("./src");
  });

  it("DEFAULT_OUTPUT_DIR is ./docs", () => {
    expect(DEFAULT_OUTPUT_DIR).toBe("./docs");
  });

  it("MARKDOWN_EXTENSIONS contains .md and .mdx", () => {
    expect(MARKDOWN_EXTENSIONS).toEqual([".md", ".mdx"]);
  });

  it("SOURCE_EXTENSIONS contains expected extensions", () => {
    expect(SOURCE_EXTENSIONS).toContain(".ts");
    expect(SOURCE_EXTENSIONS).toContain(".tsx");
    expect(SOURCE_EXTENSIONS).toContain(".js");
    expect(SOURCE_EXTENSIONS).toContain(".jsx");
    expect(SOURCE_EXTENSIONS).toContain(".mjs");
    expect(SOURCE_EXTENSIONS).toContain(".cjs");
    expect(SOURCE_EXTENSIONS.length).toBe(6);
  });

  it("CACHE_MANIFEST is manifest.json", () => {
    expect(CACHE_MANIFEST).toBe("manifest.json");
  });

  it("DEFAULT_TITLE is Documentation", () => {
    expect(DEFAULT_TITLE).toBe("Documentation");
  });

  it("DEFAULT_DESCRIPTION is Project documentation", () => {
    expect(DEFAULT_DESCRIPTION).toBe("Project documentation");
  });

  it("SUPPORTED_PACKAGE_MANAGERS contains npm, pnpm, yarn, bun", () => {
    expect(SUPPORTED_PACKAGE_MANAGERS).toEqual(["npm", "pnpm", "yarn", "bun"]);
  });

  it("DEFAULT_IGNORE_PATTERNS contains standard ignore entries", () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain("node_modules");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("dist");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("build");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".git");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".turbo");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("coverage");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".vetwo");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".docs-cache");
  });

  it("LIFECYCLE_HOOKS contains all expected hook names", () => {
    expect(LIFECYCLE_HOOKS).toEqual([
      "init",
      "discover",
      "config",
      "load",
      "transform",
      "generate",
      "output",
      "done",
      "error",
    ]);
  });

  it("DEFAULT_TOC_HEADING is Table of Contents", () => {
    expect(DEFAULT_TOC_HEADING).toBe("Table of Contents");
  });

  it("DEFAULT_SEARCH_INDEX_FILE is search-index.json", () => {
    expect(DEFAULT_SEARCH_INDEX_FILE).toBe("search-index.json");
  });

  it("DEFAULT_SITEMAP_FILE is sitemap.xml", () => {
    expect(DEFAULT_SITEMAP_FILE).toBe("sitemap.xml");
  });

  it("DEFAULT_ROBOTS_FILE is robots.txt", () => {
    expect(DEFAULT_ROBOTS_FILE).toBe("robots.txt");
  });

  it("DEFAULT_RSS_FILE is feed.xml", () => {
    expect(DEFAULT_RSS_FILE).toBe("feed.xml");
  });
});
