import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCacheStore } from "./index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("cache/index", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cache-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("createCacheStore", () => {
    it("returns a cache store with all required methods", () => {
      const store = createCacheStore(tempDir);
      expect(typeof store.get).toBe("function");
      expect(typeof store.set).toBe("function");
      expect(typeof store.has).toBe("function");
      expect(typeof store.invalidate).toBe("function");
      expect(typeof store.invalidateAll).toBe("function");
      expect(typeof store.save).toBe("function");
      expect(typeof store.load).toBe("function");
      expect(typeof store.getStats).toBe("function");
    });

    it("set and get round-trips a value", () => {
      const store = createCacheStore(tempDir);
      store.set("key1", "value1");
      expect(store.get("key1")).toBe("value1");
    });

    it("get returns undefined for missing key", () => {
      const store = createCacheStore(tempDir);
      expect(store.get("missing")).toBeUndefined();
    });

    it("has returns true for existing key", () => {
      const store = createCacheStore(tempDir);
      store.set("k", "v");
      expect(store.has("k")).toBe(true);
    });

    it("has returns false for missing key", () => {
      const store = createCacheStore(tempDir);
      expect(store.has("nope")).toBe(false);
    });

    it("invalidate removes a specific entry", () => {
      const store = createCacheStore(tempDir);
      store.set("k", "v");
      store.invalidate("k");
      expect(store.get("k")).toBeUndefined();
      expect(store.has("k")).toBe(false);
    });

    it("invalidateAll clears all entries", () => {
      const store = createCacheStore(tempDir);
      store.set("a", "1");
      store.set("b", "2");
      store.invalidateAll();
      expect(store.get("a")).toBeUndefined();
      expect(store.get("b")).toBeUndefined();
    });

    it("save and load persist manifest to disk", () => {
      const store = createCacheStore(tempDir);
      store.set("key", "val");
      store.save();

      const store2 = createCacheStore(tempDir);
      store2.load();
      expect(store2.get("key")).toBe("val");
    });

    it("load handles missing manifest gracefully", () => {
      const store = createCacheStore(tempDir);
      expect(() => store.load()).not.toThrow();
    });

    it("getStats returns correct counts", () => {
      const store = createCacheStore(tempDir);
      store.set("a", "1");
      store.set("b", "2");
      store.get("a");
      store.get("missing");
      const stats = store.getStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it("overwrites existing values", () => {
      const store = createCacheStore(tempDir);
      store.set("k", "v1");
      store.set("k", "v2");
      expect(store.get("k")).toBe("v2");
    });

    it("loads from disk if memory cache is empty", () => {
      const store = createCacheStore(tempDir);
      store.set("persistent", "data");
      store.save();

      const freshStore = createCacheStore(tempDir);
      freshStore.load();
      expect(freshStore.get("persistent")).toBe("data");
    });
  });
});
