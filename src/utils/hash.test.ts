import { describe, it, expect } from "vitest";
import { hashString, hashFile, hashFiles } from "./hash.js";

describe("utils/hash", () => {
  describe("hashString", () => {
    it("returns a 16-character hex string", () => {
      const hash = hashString("hello");
      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it("produces consistent hashes for same input", () => {
      expect(hashString("test")).toBe(hashString("test"));
    });

    it("produces different hashes for different inputs", () => {
      expect(hashString("hello")).not.toBe(hashString("world"));
    });

    it("handles empty string", () => {
      const hash = hashString("");
      expect(hash).toHaveLength(16);
    });
  });

  describe("hashFile", () => {
    it("produces same hash as hashString for same content", () => {
      const content = "file content here";
      expect(hashFile(content)).toBe(hashString(content));
    });

    it("returns consistent results", () => {
      expect(hashFile("abc")).toBe(hashFile("abc"));
    });
  });

  describe("hashFiles", () => {
    it("produces a hash from multiple files", () => {
      const hash = hashFiles([
        { path: "a.ts", content: "hello" },
        { path: "b.ts", content: "world" },
      ]);
      expect(hash).toHaveLength(16);
    });

    it("is order-independent due to sorting by path", () => {
      const hash1 = hashFiles([
        { path: "a.ts", content: "hello" },
        { path: "b.ts", content: "world" },
      ]);
      const hash2 = hashFiles([
        { path: "b.ts", content: "world" },
        { path: "a.ts", content: "hello" },
      ]);
      expect(hash1).toBe(hash2);
    });

    it("different contents produce different hashes", () => {
      const hash1 = hashFiles([{ path: "a.ts", content: "v1" }]);
      const hash2 = hashFiles([{ path: "a.ts", content: "v2" }]);
      expect(hash1).not.toBe(hash2);
    });

    it("different paths produce different hashes", () => {
      const hash1 = hashFiles([{ path: "a.ts", content: "same" }]);
      const hash2 = hashFiles([{ path: "b.ts", content: "same" }]);
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty array", () => {
      const hash = hashFiles([]);
      expect(hash).toHaveLength(16);
    });
  });
});
