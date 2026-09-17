import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectPackageManager,
  detectPM,
  detectProjectType,
  detectWorkspaces,
  detectTypeScript,
  detectGit,
  detectReadme,
  detectChangelog,
  detectProject,
} from "./project.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("discovery/project", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proj-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writePackageJson(data: Record<string, unknown>) {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(data), "utf-8");
  }

  describe("detectPackageManager", () => {
    it("detects npm from package-lock.json", () => {
      writeFileSync(join(tempDir, "package-lock.json"), "{}");
      expect(detectPackageManager(tempDir)).toBe("npm");
    });

    it("detects pnpm from pnpm-lock.yaml", () => {
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });

    it("detects yarn from yarn.lock", () => {
      writeFileSync(join(tempDir, "yarn.lock"), "");
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("detects bun from bun.lockb", () => {
      writeFileSync(join(tempDir, "bun.lockb"), "");
      expect(detectPackageManager(tempDir)).toBe("bun");
    });

    it("detects from packageManager field", () => {
      writePackageJson({ packageManager: "pnpm@8.0.0" });
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });

    it("defaults to npm when no lock files or packageManager", () => {
      expect(detectPackageManager(tempDir)).toBe("npm");
    });

    it("lock file takes precedence over packageManager field", () => {
      writePackageJson({ packageManager: "yarn@3.0.0" });
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });
  });

  describe("detectProjectType", () => {
    it("returns unknown when no package.json", () => {
      expect(detectProjectType(tempDir)).toBe("unknown");
    });

    it("detects monorepo when workspaces is defined", () => {
      writePackageJson({ workspaces: ["packages/*"] });
      expect(detectProjectType(tempDir)).toBe("monorepo");
    });

    it("detects application when framework dependency present", () => {
      writePackageJson({ dependencies: { next: "14.0.0" } });
      expect(detectProjectType(tempDir)).toBe("application");
    });

    it("detects library when build script exists", () => {
      writePackageJson({ scripts: { build: "tsup" } });
      expect(detectProjectType(tempDir)).toBe("library");
    });

    it("detects library when src/index.ts exists", () => {
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src", "index.ts"), "");
      writePackageJson({});
      expect(detectProjectType(tempDir)).toBe("library");
    });

    it("returns unknown for empty package.json without indicators", () => {
      writePackageJson({});
      expect(detectProjectType(tempDir)).toBe("unknown");
    });
  });

  describe("detectWorkspaces", () => {
    it("returns empty when no workspaces", () => {
      writePackageJson({});
      expect(detectWorkspaces(tempDir)).toEqual([]);
    });

    it("returns empty when no package.json", () => {
      expect(detectWorkspaces(tempDir)).toEqual([]);
    });

    it("detects array workspaces", () => {
      writePackageJson({ workspaces: ["packages/*", "apps/*"] });
      expect(detectWorkspaces(tempDir)).toEqual(["packages/*", "apps/*"]);
    });

    it("detects object workspaces", () => {
      writePackageJson({ workspaces: { packages: ["packages/*"] } });
      expect(detectWorkspaces(tempDir)).toEqual(["packages/*"]);
    });
  });

  describe("detectTypeScript", () => {
    it("returns true when tsconfig.json exists", () => {
      writeFileSync(join(tempDir, "tsconfig.json"), "{}");
      expect(detectTypeScript(tempDir)).toBe(true);
    });

    it("returns false when no tsconfig.json", () => {
      expect(detectTypeScript(tempDir)).toBe(false);
    });
  });

  describe("detectGit", () => {
    it("returns true when .git exists", () => {
      mkdirSync(join(tempDir, ".git"));
      expect(detectGit(tempDir)).toBe(true);
    });

    it("returns false when no .git", () => {
      expect(detectGit(tempDir)).toBe(false);
    });
  });

  describe("detectReadme", () => {
    it("detects README.md", () => {
      writeFileSync(join(tempDir, "README.md"), "# Hello");
      expect(detectReadme(tempDir)).toBe(join(tempDir, "README.md"));
    });

    it("detects readme.md", () => {
      writeFileSync(join(tempDir, "readme.md"), "# Hello");
      expect(detectReadme(tempDir)).toBe(join(tempDir, "readme.md"));
    });

    it("detects README.mdx", () => {
      writeFileSync(join(tempDir, "README.mdx"), "# Hello");
      expect(detectReadme(tempDir)).toBe(join(tempDir, "README.mdx"));
    });

    it("returns undefined when no readme", () => {
      expect(detectReadme(tempDir)).toBeUndefined();
    });
  });

  describe("detectChangelog", () => {
    it("detects CHANGELOG.md", () => {
      writeFileSync(join(tempDir, "CHANGELOG.md"), "# Changelog");
      expect(detectChangelog(tempDir)).toBe(join(tempDir, "CHANGELOG.md"));
    });

    it("detects CHANGES.md", () => {
      writeFileSync(join(tempDir, "CHANGES.md"), "# Changes");
      expect(detectChangelog(tempDir)).toBe(join(tempDir, "CHANGES.md"));
    });

    it("returns undefined when no changelog", () => {
      expect(detectChangelog(tempDir)).toBeUndefined();
    });
  });

  describe("detectProject", () => {
    it("returns full project detection object", () => {
      writePackageJson({ name: "test-pkg", version: "1.0.0" });
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src", "index.ts"), "");
      writeFileSync(join(tempDir, "tsconfig.json"), "{}");
      mkdirSync(join(tempDir, ".git"));
      writeFileSync(join(tempDir, "README.md"), "# Hi");

      const detection = detectProject(tempDir);
      expect(detection.rootDir).toBe(tempDir);
      expect(detection.packageManager).toBe("npm");
      expect(detection.hasTypeScript).toBe(true);
      expect(detection.hasGit).toBe(true);
      expect(detection.readmePath).toBe(join(tempDir, "README.md"));
    });
  });

  describe("detectPackageManager from project directory", () => {
    it("returns a valid package manager", () => {
      const pm = detectPackageManager(process.cwd());
      expect(["npm", "pnpm", "yarn", "bun"]).toContain(pm);
    });
  });

  describe("detectPM", () => {
    it("returns a valid package manager", async () => {
      const pm = await detectPM(process.cwd());
      expect(["npm", "pnpm", "yarn", "bun"]).toContain(pm);
    });

    it("returns a valid package manager for non-existent directory", async () => {
      const pm = await detectPM("/tmp/nonexistent-dir-xyz");
      expect(["npm", "pnpm", "yarn", "bun"]).toContain(pm);
    }, 15000);
  });
});
