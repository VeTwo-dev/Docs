import { describe, it, expect } from "vitest";
import { ReferenceCache } from "./index.js";
import { emptyFileBindings } from "../models/index.js";

describe("ReferenceCache", () => {
  it("stores and retrieves bindings by file + hash", () => {
    const cache = new ReferenceCache();
    const bindings = emptyFileBindings("src/a.ts");
    cache.put("src/a.ts", "h1", bindings);
    expect(cache.has("src/a.ts", "h1")).toBe(true);
    expect(cache.get("src/a.ts", "h1")).toBe(bindings);
    expect(cache.peek("src/a.ts")).toBe(bindings);
  });

  it("invalidates entries on hash mismatch", () => {
    const cache = new ReferenceCache();
    cache.put("src/a.ts", "h1", emptyFileBindings("src/a.ts"));
    expect(cache.has("src/a.ts", "h2")).toBe(false);
    expect(cache.get("src/a.ts", "h2")).toBeUndefined();
    expect(cache.peek("src/a.ts")).toBeDefined();
  });

  it("deletes, counts and clears entries", () => {
    const cache = new ReferenceCache();
    cache.put("src/a.ts", "h1", emptyFileBindings("src/a.ts"));
    cache.put("src/b.ts", "h2", emptyFileBindings("src/b.ts"));
    expect(cache.size).toBe(2);
    expect(cache.files().sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(cache.delete("src/a.ts")).toBe(true);
    expect(cache.delete("src/a.ts")).toBe(false);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
