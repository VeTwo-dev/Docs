import { describe, it, expect } from "vitest";
import { createComponentRegistry, generateComponentCSS } from "./registry.js";
import { Callout, CodeBlock, Tabs, Tab } from "./built-in.js";

describe("createComponentRegistry", () => {
  it("includes built-in components by default", () => {
    const registry = createComponentRegistry();
    expect(registry.has("Callout")).toBe(true);
    expect(registry.has("CodeBlock")).toBe(true);
    expect(registry.has("Tabs")).toBe(true);
    expect(registry.has("Tab")).toBe(true);
  });

  it("registers a custom component", () => {
    const registry = createComponentRegistry();
    registry.register({
      name: "CustomBox",
      render: () => "<div>custom</div>",
    });
    expect(registry.has("CustomBox")).toBe(true);
    expect(registry.get("CustomBox")?.name).toBe("CustomBox");
  });

  it("registers multiple components at once", () => {
    const registry = createComponentRegistry();
    registry.registerAll([
      { name: "A", render: () => "" },
      { name: "B", render: () => "" },
    ]);
    expect(registry.has("A")).toBe(true);
    expect(registry.has("B")).toBe(true);
  });

  it("returns all components", () => {
    const registry = createComponentRegistry();
    const all = registry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Callout component", () => {
  it("renders info callout", () => {
    const html = Callout.render({ type: "info" }, "<p>Note</p>");
    expect(html).toContain("callout-info");
    expect(html).toContain("<p>Note</p>");
  });

  it("renders with title", () => {
    const html = Callout.render({ type: "warning", title: "Warning" }, "<p>Content</p>");
    expect(html).toContain("Warning");
    expect(html).toContain("callout-warning");
  });

  it("defaults to info type", () => {
    const html = Callout.render({}, "<p>Note</p>");
    expect(html).toContain("callout-info");
  });
});

describe("CodeBlock component", () => {
  it("renders code block", () => {
    const html = CodeBlock.render({ language: "ts" }, "const x = 1;");
    expect(html).toContain("<pre");
    expect(html).toContain("const x = 1;");
    expect(html).toContain('data-language="ts"');
  });

  it("renders with title", () => {
    const html = CodeBlock.render({ title: "example.ts" }, "code");
    expect(html).toContain("example.ts");
    expect(html).toContain("code-block-title");
  });

  it("includes copy button", () => {
    const html = CodeBlock.render({}, "code");
    expect(html).toContain("code-copy-btn");
    expect(html).toContain("clipboard");
  });
});

describe("Tabs component", () => {
  it("renders tabs container", () => {
    const html = Tabs.render({ id: "my-tabs" }, "<div>tab content</div>");
    expect(html).toContain("tabs");
    expect(html).toContain('data-tabs-id="my-tabs"');
  });
});

describe("Tab component", () => {
  it("renders tab panel", () => {
    const html = Tab.render({ label: "npm" }, "<p>npm install</p>");
    expect(html).toContain("tab-panel");
    expect(html).toContain("npm");
    expect(html).toContain("npm install");
  });
});

describe("generateComponentCSS", () => {
  it("generates CSS for components", () => {
    const css = generateComponentCSS();
    expect(css).toContain(".callout");
    expect(css).toContain(".code-block");
    expect(css).toContain(".tabs");
    expect(css).toContain(".code-copy-btn");
  });
});
