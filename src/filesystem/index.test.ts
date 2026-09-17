import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  slugify,
  capitalize,
  generateId,
  isMarkdown,
  isMdx,
  ensureDir,
  writeFile,
  readFile,
  fileExists,
  glob,
  findFiles,
  resolvePath,
  relativePath,
  getFileExtension,
  getFileName,
  getFileSize,
  getFileMtime,
} from "./index.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("filesystem/index", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("slugify", () => {
    it("converts text to lowercase slug", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("removes special characters", () => {
      expect(slugify("Hello, World!")).toBe("hello-world");
    });

    it("replaces underscores with hyphens", () => {
      expect(slugify("hello_world")).toBe("hello-world");
    });

    it("trims leading and trailing hyphens", () => {
      expect(slugify("-hello-")).toBe("hello");
    });

    it("collapses multiple spaces into one hyphen", () => {
      expect(slugify("hello   world")).toBe("hello-world");
    });

    it("handles empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("handles already slugged text", () => {
      expect(slugify("hello-world")).toBe("hello-world");
    });
  });

  describe("capitalize", () => {
    it("capitalizes first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
    });

    it("handles empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("handles single character", () => {
      expect(capitalize("a")).toBe("A");
    });

    it("preserves rest of string", () => {
      expect(capitalize("hello world")).toBe("Hello world");
    });
  });

  describe("generateId", () => {
    it("returns just name for root-level files", () => {
      expect(generateId("/root/readme.md", "/root")).toBe("readme");
    });

    it("returns dir/name for nested files", () => {
      expect(generateId("/root/docs/readme.md", "/root")).toBe("docs/readme");
    });

    it("returns dir/name for nested files", () => {
      expect(generateId("/root/docs/guide/intro.md", "/root")).toBe("docs/guide/intro");
    });

    it("handles deeply nested paths", () => {
      expect(generateId("/root/a/b/c/file.ts", "/root")).toBe("a/b/c/file");
    });
  });

  describe("isMarkdown", () => {
    it("returns true for .md files", () => {
      expect(isMarkdown("readme.md")).toBe(true);
    });

    it("returns true for .mdx files", () => {
      expect(isMarkdown("readme.mdx")).toBe(true);
    });

    it("returns false for .ts files", () => {
      expect(isMarkdown("file.ts")).toBe(false);
    });

    it("returns false for .txt files", () => {
      expect(isMarkdown("file.txt")).toBe(false);
    });
  });

  describe("isMdx", () => {
    it("returns true for .mdx files", () => {
      expect(isMdx("readme.mdx")).toBe(true);
    });

    it("returns false for .md files", () => {
      expect(isMdx("readme.md")).toBe(false);
    });

    it("returns false for other extensions", () => {
      expect(isMdx("file.txt")).toBe(false);
    });
  });

  describe("resolvePath", () => {
    it("resolves segments relative to rootDir", () => {
      const result = resolvePath("/root", "src", "file.ts");
      expect(result).toBe("/root/src/file.ts");
    });
  });

  describe("relativePath", () => {
    it("computes relative path", () => {
      const result = relativePath("/a/b", "/a/b/c/d");
      expect(result).toBe("c/d");
    });
  });

  describe("getFileExtension", () => {
    it("returns extension with dot", () => {
      expect(getFileExtension("file.md")).toBe(".md");
    });

    it("returns empty string for no extension", () => {
      expect(getFileExtension("Makefile")).toBe("");
    });
  });

  describe("getFileName", () => {
    it("returns filename without extension", () => {
      expect(getFileName("file.md")).toBe("file");
    });

    it("handles nested paths", () => {
      expect(getFileName("/path/to/file.ts")).toBe("file");
    });
  });

  describe("ensureDir", () => {
    it("creates directory if it does not exist", () => {
      const dirPath = join(tempDir, "new-dir");
      ensureDir(dirPath);
      expect(fileExists(dirPath)).toBe(true);
    });

    it("creates nested directories recursively", () => {
      const dirPath = join(tempDir, "a", "b", "c");
      ensureDir(dirPath);
      expect(fileExists(dirPath)).toBe(true);
    });

    it("does not throw if directory already exists", () => {
      expect(() => ensureDir(tempDir)).not.toThrow();
    });
  });

  describe("writeFile", () => {
    it("writes content to file and creates parent dirs", () => {
      const filePath = join(tempDir, "sub", "file.txt");
      writeFile(filePath, "hello world");
      expect(readFile(filePath)).toBe("hello world");
    });
  });

  describe("readFile", () => {
    it("reads file content", () => {
      const filePath = join(tempDir, "test.txt");
      writeFileSync(filePath, "content here", "utf-8");
      expect(readFile(filePath)).toBe("content here");
    });
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      const filePath = join(tempDir, "exists.txt");
      writeFileSync(filePath, "x", "utf-8");
      expect(fileExists(filePath)).toBe(true);
    });

    it("returns false for non-existing file", () => {
      expect(fileExists(join(tempDir, "nope.txt"))).toBe(false);
    });
  });

  describe("getFileSize", () => {
    it("returns file size in bytes", () => {
      const filePath = join(tempDir, "sized.txt");
      writeFileSync(filePath, "hello", "utf-8");
      expect(getFileSize(filePath)).toBe(5);
    });
  });

  describe("getFileMtime", () => {
    it("returns a Date object", () => {
      const filePath = join(tempDir, "mtime.txt");
      writeFileSync(filePath, "x", "utf-8");
      const mtime = getFileMtime(filePath);
      expect(mtime).toBeInstanceOf(Date);
    });
  });

  describe("glob", () => {
    it("finds matching files", async () => {
      writeFileSync(join(tempDir, "a.md"), "a");
      writeFileSync(join(tempDir, "b.md"), "b");
      writeFileSync(join(tempDir, "c.txt"), "c");
      const results = await glob(["**/*.md"], tempDir);
      expect(results.sort()).toEqual(["a.md", "b.md"]);
    });

    it("returns empty for no matches", async () => {
      const results = await glob(["**/*.xyz"], tempDir);
      expect(results).toEqual([]);
    });
  });

  describe("findFiles", () => {
    it("finds and sorts files", async () => {
      writeFileSync(join(tempDir, "z.md"), "z");
      writeFileSync(join(tempDir, "a.md"), "a");
      const results = await findFiles(["**/*.md"], tempDir);
      expect(results).toEqual(["a.md", "z.md"]);
    });

    it("respects ignore patterns", async () => {
      writeFileSync(join(tempDir, "a.md"), "a");
      mkdirSync(join(tempDir, "node_modules"), { recursive: true });
      writeFileSync(join(tempDir, "node_modules", "b.md"), "b");
      const results = await findFiles(["**/*.md"], tempDir, ["node_modules"]);
      expect(results).toEqual(["a.md"]);
    });
  });
});
