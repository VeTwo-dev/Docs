import { describe, it, expect } from "vitest";
import { validateConfig, validateConfigWarnings } from "./validation.js";

describe("validateConfig", () => {
  it("accepts a valid minimal config object", () => {
    const result = validateConfig({ title: "Test Docs" });
    expect(result.title).toBe("Test Docs");
  });

  it("accepts a fully-specified valid config object", () => {
    const result = validateConfig({
      title: "Full Config",
      description: "A full docs config",
      source: "./docs",
      output: "./dist",
      baseUrl: "https://example.com",
      theme: "dark",
      nav: { items: [{ label: "Home", href: "/" }] },
      sidebar: { groups: [{ title: "Guide", items: [{ label: "Intro", href: "/intro" }] }] },
      seo: { title: "SEO Title", description: "SEO Desc" },
      search: { enabled: true },
      versioning: { enabled: false },
      sitemap: true,
      rss: true,
      robots: true,
      og: true,
      markdown: { gfm: true, toc: true, tocDepth: 3 },
      api: { enabled: true, source: "./src" },
    });
    expect(result.title).toBe("Full Config");
    expect(result.theme).toBe("dark");
  });

  it("accepts theme as an object with optional fields", () => {
    const result = validateConfig({
      title: "Themed",
      theme: { name: "custom", logo: "/logo.png", favicon: "/favicon.ico" },
    });
    expect(typeof result.theme).toBe("object");
  });

  it("throws on invalid data with wrong types", () => {
    expect(() => validateConfig({ title: 123 })).toThrow("Configuration validation failed");
  });

  it("throws on completely invalid input", () => {
    expect(() => validateConfig("not-an-object")).toThrow("Configuration validation failed");
  });

  it("throws on invalid nested structures", () => {
    expect(() => validateConfig({ nav: { items: "not-an-array" } })).toThrow(
      "Configuration validation failed",
    );
  });
});

describe("validateConfigWarnings", () => {
  it("returns warning for deprecated outputDir field", () => {
    const warnings = validateConfigWarnings({ outputDir: "./build" });
    expect(warnings).toContain('Config field "outputDir" is deprecated. Use "output" instead.');
  });

  it("returns warning for deprecated docsDir field", () => {
    const warnings = validateConfigWarnings({ docsDir: "./docs" });
    expect(warnings).toContain('Config field "docsDir" is deprecated. Use "source" instead.');
  });

  it("returns warning for deprecated siteUrl field", () => {
    const warnings = validateConfigWarnings({ siteUrl: "https://example.com" });
    expect(warnings).toContain('Config field "siteUrl" is deprecated. Use "baseUrl" instead.');
  });

  it("returns multiple warnings when multiple deprecated fields present", () => {
    const warnings = validateConfigWarnings({
      outputDir: "./build",
      docsDir: "./docs",
      siteUrl: "https://example.com",
    });
    expect(warnings).toHaveLength(3);
  });

  it("returns empty array for clean config with no deprecated fields", () => {
    const warnings = validateConfigWarnings({
      title: "Clean",
      output: "./dist",
      source: "./docs",
    });
    expect(warnings).toHaveLength(0);
  });

  it("returns empty array for undefined input", () => {
    const warnings = validateConfigWarnings(undefined);
    expect(warnings).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    const warnings = validateConfigWarnings(null);
    expect(warnings).toHaveLength(0);
  });

  it("returns empty array for primitive input", () => {
    const warnings = validateConfigWarnings("string");
    expect(warnings).toHaveLength(0);
  });
});
