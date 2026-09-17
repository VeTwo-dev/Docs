import { describe, it, expect } from "vitest";
import { createHtmlRenderer, createDefaultTemplate } from "./index.js";

describe("createHtmlRenderer", () => {
  it("has correct name", () => {
    const renderer = createHtmlRenderer();
    expect(renderer.name).toBe("html");
  });

  it("render returns content as-is", () => {
    const renderer = createHtmlRenderer();
    const content = "<h1>Hello</h1><p>World</p>";

    const result = renderer.render(content);

    expect(result).toBe(content);
  });

  it("render returns empty string for empty input", () => {
    const renderer = createHtmlRenderer();

    const result = renderer.render("");

    expect(result).toBe("");
  });

  it("render passes through any HTML content", () => {
    const renderer = createHtmlRenderer();
    const html = `<div class="test"><span style="color: red">Hello</span></div>`;

    const result = renderer.render(html);

    expect(result).toBe(html);
  });
});

describe("createDefaultTemplate (re-export)", () => {
  it("is exported from renderers", () => {
    expect(createDefaultTemplate).toBeDefined();
    expect(typeof createDefaultTemplate).toBe("function");
  });

  it("returns template with name default", () => {
    const template = createDefaultTemplate();
    expect(template.name).toBe("default");
  });
});
