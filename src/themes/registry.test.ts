import { describe, it, expect } from "vitest";
import { resolveTheme, mergeTheme, generateThemeCSS, generateStylesheet } from "./registry.js";
import { defaultTheme, midnightTheme, BUILT_IN_THEMES } from "./built-in.js";

describe("resolveTheme", () => {
  it("resolves 'default' theme", () => {
    const theme = resolveTheme("default");
    expect(theme.name).toBe("default");
    expect(theme.light).toBeDefined();
    expect(theme.dark).toBeDefined();
  });

  it("resolves 'midnight' theme", () => {
    const theme = resolveTheme("midnight");
    expect(theme.name).toBe("midnight");
  });

  it("returns Theme object as-is", () => {
    const result = resolveTheme(defaultTheme);
    expect(result).toBe(defaultTheme);
  });

  it("throws for unknown theme name", () => {
    expect(() => resolveTheme("nonexistent")).toThrow("Unknown theme");
  });
});

describe("mergeTheme", () => {
  it("merges partial overrides onto base theme", () => {
    const merged = mergeTheme(defaultTheme, {
      name: "custom",
      fonts: { bodySize: "18px" },
    });
    expect(merged.name).toBe("custom");
    expect(merged.fonts.bodySize).toBe("18px");
    expect(merged.fonts.heading).toBe(defaultTheme.fonts.heading);
  });

  it("merges color overrides", () => {
    const merged = mergeTheme(defaultTheme, {
      light: { primary: "#ff0000" },
    });
    expect(merged.light.primary).toBe("#ff0000");
    expect(merged.light.background).toBe(defaultTheme.light.background);
  });
});

describe("generateThemeCSS", () => {
  it("generates CSS with CSS custom properties", () => {
    const css = generateThemeCSS(defaultTheme);
    expect(css).toContain("--light-primary:");
    expect(css).toContain("--dark-primary:");
    expect(css).toContain("--font-body:");
    expect(css).toContain("--content-max-width:");
    expect(css).toContain("color-scheme: light dark");
  });

  it("includes data-theme rules", () => {
    const css = generateThemeCSS(defaultTheme);
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="light"]');
  });

  it("includes prefers-color-scheme media query", () => {
    const css = generateThemeCSS(defaultTheme);
    expect(css).toContain("@media (prefers-color-scheme: dark)");
  });
});

describe("generateStylesheet", () => {
  it("generates a complete stylesheet", () => {
    const css = generateStylesheet(defaultTheme);
    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("font-family:");
    expect(css).toContain(".site-header");
    expect(css).toContain(".sidebar");
    expect(css).toContain(".content");
    expect(css).toContain(".theme-toggle");
    expect(css).toContain(".callout");
  });

  it("includes layout styles", () => {
    const css = generateStylesheet(defaultTheme);
    expect(css).toContain(".layout");
    expect(css).toContain("display: flex");
    expect(css).toContain("sticky");
  });

  it("midnight theme has different colors", () => {
    const defaultCSS = generateThemeCSS(defaultTheme);
    const midnightCSS = generateThemeCSS(midnightTheme);
    expect(defaultCSS).not.toBe(midnightCSS);
    expect(midnightCSS).toContain("--light-primary: #a78bfa");
  });
});

describe("BUILT_IN_THEMES", () => {
  it("contains default, midnight, and forest themes", () => {
    expect(BUILT_IN_THEMES.has("default")).toBe(true);
    expect(BUILT_IN_THEMES.has("midnight")).toBe(true);
    expect(BUILT_IN_THEMES.has("forest")).toBe(true);
  });

  it("each theme has light and dark colors", () => {
    for (const theme of BUILT_IN_THEMES.values()) {
      expect(theme.light).toBeDefined();
      expect(theme.dark).toBeDefined();
      expect(theme.light.primary).toBeDefined();
      expect(theme.dark.primary).toBeDefined();
    }
  });
});
