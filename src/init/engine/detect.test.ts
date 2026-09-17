import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import {
  readPackageMeta,
  detectProjectInfo,
  findConfigFile,
  resolveProjectRoot,
  ALTERNATIVE_DOC_DIRS,
} from "./detect.js";

const ROOT = "/project";

describe("readPackageMeta", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("parses package.json when present", () => {
    fs.writeFile(
      `${ROOT}/package.json`,
      '{"name":"acme","description":"d","workspaces":["packages/*"]}',
    );
    expect(readPackageMeta(fs, ROOT)).toEqual({
      name: "acme",
      description: "d",
      workspaces: ["packages/*"],
    });
  });

  it("returns empty meta when missing or malformed", () => {
    expect(readPackageMeta(fs, ROOT)).toEqual({});
    fs.writeFile(`${ROOT}/package.json`, "{ not json");
    expect(readPackageMeta(fs, ROOT)).toEqual({});
  });
});

describe("detectProjectInfo", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("detects a library project with npm and no TypeScript", () => {
    fs.writeFile(`${ROOT}/package.json`, '{"name":"lib"}');
    const info = detectProjectInfo(fs, ROOT);
    expect(info.name).toBe("lib");
    expect(info.projectType).toBe("library");
    expect(info.packageManager).toBe("npm");
    expect(info.hasTypeScript).toBe(false);
    expect(info.hasGit).toBe(false);
  });

  it("detects package manager lockfiles, tsconfig and git", () => {
    fs.writeFile(`${ROOT}/package.json`, '{"name":"p"}');
    fs.writeFile(`${ROOT}/pnpm-lock.yaml`, "");
    fs.writeFile(`${ROOT}/tsconfig.json`, "{}");
    fs.mkdir(`${ROOT}/.git`);
    const info = detectProjectInfo(fs, ROOT);
    expect(info.packageManager).toBe("pnpm");
    expect(info.hasTypeScript).toBe(true);
    expect(info.hasGit).toBe(true);
  });

  it("detects a monorepo and discovers workspace packages", () => {
    fs.writeFile(`${ROOT}/package.json`, '{"name":"mono","workspaces":["packages/*"]}');
    fs.writeFile(`${ROOT}/packages/a/package.json`, '{"name":"a","description":"pkg a"}');
    fs.writeFile(`${ROOT}/packages/b/package.json`, '{"name":"b"}');
    const info = detectProjectInfo(fs, ROOT);
    expect(info.projectType).toBe("monorepo");
    expect(info.packages).toHaveLength(2);
    expect(info.packages[0]).toEqual({ name: "a", description: "pkg a" });
  });

  it("ignores malformed workspace manifests", () => {
    fs.writeFile(`${ROOT}/package.json`, '{"name":"mono","workspaces":["packages/*"]}');
    fs.writeFile(`${ROOT}/packages/bad/package.json`, "{ not json");
    const info = detectProjectInfo(fs, ROOT);
    expect(info.packages).toHaveLength(0);
  });

  it("treats non-array workspaces as a plain library", () => {
    fs.writeFile(`${ROOT}/package.json`, '{"name":"lib","workspaces":"packages"}');
    const info = detectProjectInfo(fs, ROOT);
    expect(info.projectType).toBe("library");
    expect(info.packages).toHaveLength(0);
  });

  it("detects readme and changelog in various casings", () => {
    fs.writeFile(`${ROOT}/readme.md`, "");
    fs.writeFile(`${ROOT}/CHANGES.md`, "");
    const info = detectProjectInfo(fs, ROOT);
    expect(info.readmePath).toBe(`${ROOT}/readme.md`);
    expect(info.changelogPath).toBe(`${ROOT}/CHANGES.md`);
  });

  it("defaults name and description when package.json is missing", () => {
    const info = detectProjectInfo(fs, ROOT);
    expect(info.name).toBe("My Project");
    expect(info.description).toBe("");
  });
});

describe("findConfigFile", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("finds an existing docs config", () => {
    fs.writeFile(`${ROOT}/docs.config.ts`, "export default defineDocs({});");
    expect(findConfigFile(fs, ROOT)).toBe(`${ROOT}/docs.config.ts`);
  });

  it("returns undefined when no config exists", () => {
    expect(findConfigFile(fs, ROOT)).toBeUndefined();
  });
});

describe("resolveProjectRoot", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("prefers an explicit rootDir", () => {
    expect(resolveProjectRoot(fs, { rootDir: "/explicit" })).toBe("/explicit");
  });

  it("walks up from cwd to the nearest package.json", () => {
    fs.writeFile(`${ROOT}/package.json`, "{}");
    fs.writeFile(`${ROOT}/a/b/c/keep.txt`, "");
    fs.mkdir(`${ROOT}/a/b/c`);
    expect(resolveProjectRoot(fs, { cwd: `${ROOT}/a/b/c` })).toBe(ROOT);
  });

  it("stops at a workspace marker while walking up", () => {
    fs.writeFile(`${ROOT}/lerna.json`, "{}");
    fs.mkdir(`${ROOT}/a/b`);
    expect(resolveProjectRoot(fs, { cwd: `${ROOT}/a/b` })).toBe(ROOT);
  });

  it("falls back to cwd when no marker exists", () => {
    fs.mkdir(`${ROOT}/empty`);
    expect(resolveProjectRoot(fs, { cwd: `${ROOT}/empty` })).toBe(`${ROOT}/empty`);
  });

  it("falls back to / when cwd is not a directory", () => {
    expect(resolveProjectRoot(fs, { cwd: "/definitely/missing" })).toBe("/");
  });
});

describe("ALTERNATIVE_DOC_DIRS", () => {
  it("lists the known alternative documentation directories", () => {
    expect([...ALTERNATIVE_DOC_DIRS]).toEqual([
      "docs",
      "wiki",
      "documentation",
      "docs-site",
      "website",
    ]);
  });
});
