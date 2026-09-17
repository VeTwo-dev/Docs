import { describe, it, expect } from "vitest";
import { defineDocs } from "./define.js";

describe("config/define", () => {
  it("returns default config when called with no arguments", () => {
    const config = defineDocs();
    expect(config.title).toBe("Documentation");
    expect(config.description).toBe("Project documentation");
    expect(config.source).toBe("./src");
    expect(config.output).toBe("./docs");
    expect(config.baseUrl).toBe("/");
    expect(config.theme).toBe("default");
    expect(config.sitemap).toBe(true);
    expect(config.rss).toBe(false);
    expect(config.robots).toBe(true);
    expect(config.watch).toBe(false);
    expect(config.clean).toBe(true);
    expect(config.cache).toBe(true);
  });

  it("merges partial title and description", () => {
    const config = defineDocs({ title: "My Docs", description: "A cool project" });
    expect(config.title).toBe("My Docs");
    expect(config.description).toBe("A cool project");
    expect(config.source).toBe("./src");
  });

  it("merges sidebar config partially", () => {
    const config = defineDocs({
      sidebar: { collapsed: true },
    });
    expect(config.sidebar.collapsed).toBe(true);
    expect(config.sidebar.auto).toBe(true);
    expect(config.sidebar.groups).toEqual([]);
  });

  it("merges seo config partially", () => {
    const config = defineDocs({
      seo: { title: "SEO Title" },
    });
    expect(config.seo.title).toBe("SEO Title");
  });

  it("merges search config partially", () => {
    const config = defineDocs({
      search: { maxResults: 10 },
    });
    expect(config.search.maxResults).toBe(10);
    expect(config.search.enabled).toBe(true);
  });

  it("merges markdown config partially", () => {
    const config = defineDocs({
      markdown: { gfm: false, tocDepth: 2 },
    });
    expect(config.markdown.gfm).toBe(false);
    expect(config.markdown.tocDepth).toBe(2);
    expect(config.markdown.breaks).toBe(false);
  });

  it("merges versioning config partially", () => {
    const config = defineDocs({
      versioning: { enabled: true, current: "v2" },
    });
    expect(config.versioning.enabled).toBe(true);
    expect(config.versioning.current).toBe("v2");
  });

  it("merges api config partially", () => {
    const config = defineDocs({
      api: { enabled: true },
    });
    expect(config.api.enabled).toBe(true);
    expect(config.api.readme).toBe(true);
  });

  it("full config overrides defaults", () => {
    const config = defineDocs({
      title: "Full Config",
      description: "Full test",
      source: "./docs-src",
      output: "./dist-docs",
      baseUrl: "/docs/",
      theme: "dark",
      sitemap: false,
      rss: true,
      robots: false,
      watch: true,
      clean: false,
      cache: false,
      ignore: ["custom"],
      include: ["*.md"],
      rehypePlugins: ["rehype-foo"],
      remarkPlugins: ["remark-bar"],
      plugins: [],
      markdown: {
        gfm: false,
        breaks: true,
        pedantic: true,
        headerIds: false,
        toc: false,
        tocDepth: 1,
        syntaxHighlighting: false,
      },
      api: {
        enabled: true,
        source: "./api-src",
        include: ["*.ts"],
        exclude: [],
        readme: false,
      },
    });
    expect(config.title).toBe("Full Config");
    expect(config.source).toBe("./docs-src");
    expect(config.baseUrl).toBe("/docs/");
    expect(config.markdown.breaks).toBe(true);
    expect(config.api.enabled).toBe(true);
    expect(config.api.readme).toBe(false);
  });

  it("returns a frozen object", () => {
    const config = defineDocs();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("sidebar object properties are accessible after freezing", () => {
    const config = defineDocs();
    expect(config.sidebar.auto).toBe(true);
    expect(config.sidebar.collapsed).toBe(false);
    expect(config.sidebar.groups).toEqual([]);
  });

  it("filters out undefined values from input", () => {
    const config = defineDocs({ title: undefined, description: undefined });
    expect(config.title).toBe("Documentation");
    expect(config.description).toBe("Project documentation");
  });

  it("preserves empty arrays when explicitly provided", () => {
    const config = defineDocs({ ignore: [], include: [] });
    expect(config.ignore).toEqual([]);
    expect(config.include).toEqual([]);
  });

  it("merges deep nested config with defu", () => {
    const config = defineDocs({
      seo: { title: "SEO", og: { image: "/og.png" } },
    });
    expect(config.seo.title).toBe("SEO");
    expect((config.seo as Record<string, unknown>).og).toEqual({ image: "/og.png" });
  });

  it("handles monorepo config", () => {
    const config = defineDocs({ monorepo: true });
    expect(config.monorepo).toBe(true);
  });

  it("handles monorepo config with root", () => {
    const config = defineDocs({ monorepo: { root: "/workspace" } });
    expect(config.monorepo).toEqual({ root: "/workspace" });
  });

  it("handles all new markdown fields", () => {
    const config = defineDocs({
      markdown: {
        mdx: true,
        smartypants: true,
        raw: true,
        document: true,
        lineHighlighting: true,
        diffHighlighting: true,
        focusRegions: true,
      },
    });
    expect(config.markdown.mdx).toBe(true);
    expect(config.markdown.smartypants).toBe(true);
    expect(config.markdown.raw).toBe(true);
    expect(config.markdown.document).toBe(true);
    expect(config.markdown.lineHighlighting).toBe(true);
    expect(config.markdown.diffHighlighting).toBe(true);
    expect(config.markdown.focusRegions).toBe(true);
  });

  it("user arrays override defaults", () => {
    const config = defineDocs({ ignore: ["custom"] });
    expect(config.ignore).toEqual(["custom"]);
  });

  it("empty arrays are preserved", () => {
    const config = defineDocs({ ignore: [] });
    expect(config.ignore).toEqual([]);
  });
});
