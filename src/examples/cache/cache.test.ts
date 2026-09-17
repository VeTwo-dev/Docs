import { describe, it, expect } from "vitest";
import { createExampleCache, contentHash } from "./index.js";
import type { RawExample } from "../extractors/index.js";

function raw(content: string): RawExample {
  return {
    title: "t",
    language: "ts",
    content,
    provenance: { kind: "docs", source: "docs/a.md" },
  };
}

describe("createExampleCache", () => {
  it("starts empty", () => {
    const cache = createExampleCache();
    expect(cache.size).toBe(0);
    expect(cache.keys).toEqual([]);
  });

  it("stores and retrieves by exact content hash", () => {
    const cache = createExampleCache();
    const examples = [raw("const x = 1;")];
    cache.set("a.md", contentHash("one"), examples);
    expect(cache.get("a.md", contentHash("one"))).toHaveLength(1);
    expect(cache.get("a.md", contentHash("two"))).toBeUndefined();
    expect(cache.has("a.md")).toBe(true);
    expect(cache.has("b.md")).toBe(false);
    expect(cache.keys).toEqual(["a.md"]);
    expect(cache.size).toBe(1);
  });

  it("returns undefined for unknown paths and stale hashes", () => {
    const cache = createExampleCache();
    expect(cache.get("nope.md", contentHash("x"))).toBeUndefined();
    cache.set("a.md", contentHash("one"), []);
    expect(cache.get("a.md", contentHash("changed"))).toBeUndefined();
  });

  it("freezes stored example arrays", () => {
    const cache = createExampleCache();
    const examples = [raw("x")];
    cache.set("a.md", contentHash("one"), examples);
    expect(Object.isFrozen(cache.get("a.md", contentHash("one")))).toBe(true);
  });

  it("reports freshness against the content hash", () => {
    const cache = createExampleCache();
    expect(cache.isFresh("a.md", contentHash("one"))).toBe(false);
    cache.set("a.md", contentHash("one"), [raw("x")]);
    expect(cache.isFresh("a.md", contentHash("one"))).toBe(true);
    expect(cache.isFresh("a.md", contentHash("two"))).toBe(false);
  });

  it("clears all entries", () => {
    const cache = createExampleCache();
    cache.set("a.md", contentHash("one"), [raw("x")]);
    cache.set("b.md", contentHash("two"), [raw("y")]);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has("a.md")).toBe(false);
  });

  it("derives stable content hashes", () => {
    expect(contentHash("same")).toBe(contentHash("same"));
    expect(contentHash("same")).not.toBe(contentHash("different"));
  });
});
