import { describe, expect, it } from "vitest";
import { DEFAULT_SCANNER_CACHE_FILE, ScannerCache, SCANNER_CACHE_VERSION } from "./cache.js";
import { MemoryProvider } from "../providers/memory.js";

describe("ScannerCache", () => {
  it("sets, gets and validates entries", () => {
    const cache = new ScannerCache();
    expect(cache.size).toBe(0);
    expect(cache.get("a.ts")).toBeUndefined();
    cache.set("a.ts", { size: 10, mtimeMs: 100, hash: "abc" });
    expect(cache.get("a.ts")).toEqual({ size: 10, mtimeMs: 100, hash: "abc" });
    expect(cache.isValid("a.ts", 10, 100)).toBe(true);
    expect(cache.isValid("a.ts", 11, 100)).toBe(false);
    expect(cache.isValid("a.ts", 10, 101)).toBe(false);
    expect(cache.isValid("missing", 10, 100)).toBe(false);
  });

  it("deletes and clears", () => {
    const cache = new ScannerCache();
    cache.set("a", { size: 1, mtimeMs: 0, hash: "x" });
    cache.delete("a");
    expect(cache.size).toBe(0);
    cache.set("b", { size: 1, mtimeMs: 0, hash: "x" });
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("serialises and rebuilds", () => {
    const cache = new ScannerCache();
    cache.set("a.ts", { size: 10, mtimeMs: 100, hash: "abc" });
    const json = cache.toJSON();
    expect(json.version).toBe(SCANNER_CACHE_VERSION);
    const rebuilt = ScannerCache.fromJSON(json);
    expect(rebuilt.get("a.ts")).toEqual({ size: 10, mtimeMs: 100, hash: "abc" });
  });

  it("sanitises invalid initial entries", () => {
    const cache = new ScannerCache({
      bad: { size: 1, mtimeMs: 1, hash: 42 } as unknown as {
        size: number;
        mtimeMs: number;
        hash: string;
      },
      good: { size: 2, mtimeMs: 2, hash: "ok" },
    });
    expect(cache.size).toBe(1);
  });

  it("loads persisted data", async () => {
    const provider = new MemoryProvider("/root");
    await provider.writeFile(
      "/root/cache.json",
      JSON.stringify({ version: 1, entries: { a: { size: 1, mtimeMs: 5, hash: "h" } } }),
    );
    const cache = new ScannerCache();
    await cache.load(provider, "/root/cache.json");
    expect(cache.get("a")).toEqual({ size: 1, mtimeMs: 5, hash: "h" });
  });

  it("ignores missing, corrupt or version-mismatched cache files", async () => {
    const provider = new MemoryProvider("/root");
    const cache = new ScannerCache();
    await cache.load(provider, "/root/nope.json");
    expect(cache.size).toBe(0);
    await provider.writeFile("/root/corrupt.json", "not json");
    await cache.load(provider, "/root/corrupt.json");
    expect(cache.size).toBe(0);
    await provider.writeFile(
      "/root/old.json",
      JSON.stringify({ version: 999, entries: { a: { size: 1, mtimeMs: 1, hash: "h" } } }),
    );
    await cache.load(provider, "/root/old.json");
    expect(cache.size).toBe(0);
  });

  it("saves through the provider", async () => {
    const provider = new MemoryProvider("/root");
    const cache = new ScannerCache();
    cache.set("a.ts", { size: 10, mtimeMs: 100, hash: "abc" });
    await cache.save(provider, DEFAULT_SCANNER_CACHE_FILE);
    expect(await provider.exists(DEFAULT_SCANNER_CACHE_FILE)).toBe(true);
    const reloaded = new ScannerCache();
    await reloaded.load(provider, DEFAULT_SCANNER_CACHE_FILE);
    expect(reloaded.get("a.ts")?.hash).toBe("abc");
  });
});
