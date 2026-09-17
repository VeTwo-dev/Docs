import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfigPath, mergePlugins, loadConfig, findMonorepoRoot } from "./loader.js";
import type { Plugin } from "../../types/internal.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "loader-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("config/loader", () => {
  describe("resolveConfigPath", () => {
    it("resolves a relative config path against rootDir", () => {
      const result = resolveConfigPath("/project", "docs.config.ts");
      expect(result).toBe("/project/docs.config.ts");
    });

    it("resolves rootDir when no configPath provided", () => {
      const result = resolveConfigPath("/project");
      expect(result).toBe("/project");
    });

    it("resolves absolute configPath as-is", () => {
      const result = resolveConfigPath("/project", "/other/config.ts");
      expect(result).toBe("/other/config.ts");
    });
  });

  describe("mergePlugins", () => {
    it("merges two non-overlapping plugin lists", () => {
      const a: Plugin[] = [{ name: "a", version: "1.0", hooks: {} }];
      const b: Plugin[] = [{ name: "b", version: "1.0", hooks: {} }];
      const result = mergePlugins(a, b);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(["a", "b"]);
    });

    it("deduplicates plugins by name", () => {
      const a: Plugin[] = [{ name: "a", version: "1.0", hooks: {} }];
      const b: Plugin[] = [
        { name: "a", version: "2.0", hooks: {} },
        { name: "b", version: "1.0", hooks: {} },
      ];
      const result = mergePlugins(a, b);
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("a");
      expect(result[0]!.version).toBe("1.0");
      expect(result[1]!.name).toBe("b");
    });

    it("returns existing plugins when additional is empty", () => {
      const a: Plugin[] = [{ name: "a", version: "1.0", hooks: {} }];
      const result = mergePlugins(a, []);
      expect(result).toHaveLength(1);
    });

    it("returns only unique additional plugins when existing is empty", () => {
      const b: Plugin[] = [{ name: "b", version: "1.0", hooks: {} }];
      const result = mergePlugins([], b);
      expect(result).toHaveLength(1);
    });

    it("returns empty when both are empty", () => {
      expect(mergePlugins([], [])).toEqual([]);
    });
  });

  describe("loadConfig", () => {
    it("loads config from package.json @vetwo/docs key", async () => {
      writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({ name: "test", "@vetwo/docs": { title: "From Package" } }),
      );
      const result = await loadConfig(tmpDir);
      expect(result.config.title).toBe("From Package");
    });

    it("falls back to defaults when no config exists", async () => {
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
      const result = await loadConfig(tmpDir);
      expect(result.config.title).toBe("Documentation");
    });

    it("uses defaults when package.json is missing", async () => {
      const result = await loadConfig(tmpDir);
      expect(result.config.title).toBe("Documentation");
    });

    it("finds config file when it exists", async () => {
      writeFileSync(join(tmpDir, "docs.config.ts"), `export default { title: "From File" };`);
      const result = await loadConfig(tmpDir);
      expect(result.config.title).toBe("From File");
    });
  });

  describe("findMonorepoRoot", () => {
    it("finds pnpm-workspace.yaml", () => {
      writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'");
      const root = findMonorepoRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it("finds lerna.json", () => {
      writeFileSync(join(tmpDir, "lerna.json"), JSON.stringify({ version: "independent" }));
      const root = findMonorepoRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it("returns undefined when not in monorepo", () => {
      const root = findMonorepoRoot("/tmp");
      expect(root).toBeUndefined();
    });

    it("respects monorepo config with package.json workspaces", () => {
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
      const root = findMonorepoRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it("finds monorepo root in parent directory", () => {
      writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'");
      const subDir = join(tmpDir, "packages", "foo");
      mkdirSync(subDir, { recursive: true });
      const root = findMonorepoRoot(subDir);
      expect(root).toBe(tmpDir);
    });
  });
});
