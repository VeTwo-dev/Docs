import { describe, it, expect } from "vitest";
import { createExampleExtractorRegistry } from "./index.js";
import { createMarkdownExampleExtractor } from "../extractors/index.js";

describe("createExampleExtractorRegistry", () => {
  it("registers and lists extractors", () => {
    const registry = createExampleExtractorRegistry();
    const markdown = createMarkdownExampleExtractor();
    registry.register(markdown);
    expect(registry.size).toBe(1);
    expect(registry.get("markdown")).toBe(markdown);
    expect(registry.list().map((e) => e.id)).toEqual(["markdown"]);
  });

  it("unregisters extractors by id", () => {
    const registry = createExampleExtractorRegistry();
    registry.register(createMarkdownExampleExtractor());
    expect(registry.unregister("markdown")).toBe(true);
    expect(registry.unregister("nope")).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("runs only extractors that support a path", () => {
    const registry = createExampleExtractorRegistry();
    registry.register(createMarkdownExampleExtractor());
    const raw = registry.extract({
      path: "README.md",
      content: "# T\n\n```ts\nconst x = 1;\n```\n",
    });
    expect(raw).toHaveLength(1);
    expect(raw[0]?.provenance.kind).toBe("readme");

    const none = registry.extract({ path: "src/index.ts", content: "" });
    expect(none).toHaveLength(0);
  });

  it("returns frozen lists", () => {
    const registry = createExampleExtractorRegistry();
    registry.register(createMarkdownExampleExtractor());
    expect(Object.isFrozen(registry.list())).toBe(true);
  });
});
