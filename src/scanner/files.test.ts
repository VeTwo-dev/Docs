import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { discoverDocFiles, discoverSourceFiles } from "./files.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("discovery/files", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "files-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("discoverDocFiles", () => {
    it("discovers .md files", async () => {
      const srcDir = join(tempDir, "docs");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "readme.md"), "# Hello");
      writeFileSync(join(srcDir, "guide.mdx"), "# Guide");

      const files = await discoverDocFiles(tempDir, srcDir);
      expect(files.length).toBe(2);
      expect(files.every((f) => f.extension === ".md" || f.extension === ".mdx")).toBe(true);
    });

    it("returns empty for no markdown files", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "file.txt"), "text");

      const files = await discoverDocFiles(tempDir, srcDir);
      expect(files).toEqual([]);
    });

    it("discovers nested markdown files", async () => {
      const srcDir = join(tempDir, "docs");
      mkdirSync(join(srcDir, "guides"), { recursive: true });
      writeFileSync(join(srcDir, "index.md"), "# Index");
      writeFileSync(join(srcDir, "guides", "intro.md"), "# Intro");

      const files = await discoverDocFiles(tempDir, srcDir);
      expect(files.length).toBe(2);
    });

    it("ignores node_modules by default", async () => {
      const srcDir = join(tempDir, "docs");
      mkdirSync(join(srcDir, "node_modules", "pkg"), { recursive: true });
      writeFileSync(join(srcDir, "readme.md"), "# Hi");
      writeFileSync(join(srcDir, "node_modules", "pkg", "readme.md"), "# Pkg");

      const files = await discoverDocFiles(tempDir, srcDir);
      expect(files.length).toBe(1);
    });

    it("respects custom ignore patterns", async () => {
      const srcDir = join(tempDir, "docs");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "a.md"), "a");
      writeFileSync(join(srcDir, "b.md"), "b");

      const files = await discoverDocFiles(tempDir, srcDir, ["b.md"]);
      expect(files.length).toBe(1);
    });

    it("returns source files with correct properties", async () => {
      const srcDir = join(tempDir, "docs");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "readme.md"), "# Hi");

      const files = await discoverDocFiles(tempDir, srcDir);
      expect(files[0]!.extension).toBe(".md");
      expect(files[0]!.path).toContain("readme.md");
      expect(files[0]!.lastModified).toBeInstanceOf(Date);
    });
  });

  describe("discoverSourceFiles", () => {
    it("discovers .ts files", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "index.ts"), "export {}");
      writeFileSync(join(srcDir, "util.ts"), "export {}");

      const files = await discoverSourceFiles(tempDir, srcDir);
      expect(files.length).toBe(2);
    });

    it("discovers .tsx, .js, .jsx files", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "a.tsx"), "");
      writeFileSync(join(srcDir, "b.js"), "");
      writeFileSync(join(srcDir, "c.jsx"), "");

      const files = await discoverSourceFiles(tempDir, srcDir);
      expect(files.length).toBe(3);
    });

    it("ignores test files by default", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "index.ts"), "");
      writeFileSync(join(srcDir, "index.test.ts"), "");
      writeFileSync(join(srcDir, "index.spec.ts"), "");

      const files = await discoverSourceFiles(tempDir, srcDir);
      expect(files.length).toBe(1);
    });

    it("ignores .d.ts files by default", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "types.d.ts"), "");
      writeFileSync(join(srcDir, "index.ts"), "");

      const files = await discoverSourceFiles(tempDir, srcDir);
      expect(files.length).toBe(1);
    });

    it("returns sorted results", async () => {
      const srcDir = join(tempDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "z.ts"), "");
      writeFileSync(join(srcDir, "a.ts"), "");
      writeFileSync(join(srcDir, "m.ts"), "");

      const files = await discoverSourceFiles(tempDir, srcDir);
      const names = files.map((f) => f.path);
      expect([...names].sort()).toEqual(names);
    });
  });
});
