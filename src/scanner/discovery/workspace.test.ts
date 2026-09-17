import { describe, expect, it } from "vitest";
import {
  detectPackageManager,
  detectWorkspaceKind,
  expandWorkspacePatterns,
  extractWorkspacesField,
  extractYamlList,
  readJsonFile,
} from "./workspace.js";
import { MemoryProvider } from "../providers/memory.js";

describe("readJsonFile", () => {
  it("reads valid JSON objects", async () => {
    const provider = new MemoryProvider("/root", { files: { "pkg.json": '{"name":"x"}' } });
    expect(await readJsonFile(provider, "/root/pkg.json")).toEqual({ name: "x" });
  });

  it("returns undefined for invalid or non-object JSON", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "bad.json": "nope", "arr.json": "[1,2]" },
    });
    expect(await readJsonFile(provider, "/root/bad.json")).toBeUndefined();
    expect(await readJsonFile(provider, "/root/arr.json")).toBeUndefined();
    expect(await readJsonFile(provider, "/root/missing.json")).toBeUndefined();
  });
});

describe("extractWorkspacesField", () => {
  it("extracts array workspaces", () => {
    expect(extractWorkspacesField({ workspaces: ["packages/*", "apps/*"] })).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  it("extracts object workspaces", () => {
    expect(
      extractWorkspacesField({ workspaces: { packages: ["packages/*"], nohoist: [] } }),
    ).toEqual(["packages/*"]);
  });

  it("returns empty for other shapes", () => {
    expect(extractWorkspacesField({ workspaces: 42 })).toEqual([]);
    expect(extractWorkspacesField({})).toEqual([]);
  });
});

describe("extractYamlList", () => {
  it("extracts a top-level list", () => {
    const content = "packages:\n  - 'packages/*'\n  - apps/*\n# comment\nother: 1\n  - ignored\n";
    expect(extractYamlList(content, "packages")).toEqual(["packages/*", "apps/*"]);
  });

  it("returns empty when the key is absent", () => {
    expect(extractYamlList("foo:\n  - bar\n", "packages")).toEqual([]);
  });
});

describe("detectPackageManager", () => {
  it("prioritises lock files", async () => {
    expect(
      await detectPackageManager(
        new MemoryProvider("/root", { files: { "pnpm-lock.yaml": "" } }),
        "/root",
      ),
    ).toBe("pnpm");
    expect(
      await detectPackageManager(
        new MemoryProvider("/root", { files: { "yarn.lock": "" } }),
        "/root",
      ),
    ).toBe("yarn");
    expect(
      await detectPackageManager(
        new MemoryProvider("/root", { files: { "bun.lockb": "" } }),
        "/root",
      ),
    ).toBe("bun");
    expect(
      await detectPackageManager(
        new MemoryProvider("/root", { files: { "bun.lock": "" } }),
        "/root",
      ),
    ).toBe("bun");
    expect(
      await detectPackageManager(
        new MemoryProvider("/root", { files: { "package-lock.json": "" } }),
        "/root",
      ),
    ).toBe("npm");
  });

  it("falls back to the packageManager field", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": '{"packageManager":"pnpm@9.0.0"}' },
    });
    expect(await detectPackageManager(provider, "/root")).toBe("pnpm");
  });

  it("defaults to npm", async () => {
    expect(await detectPackageManager(new MemoryProvider("/root"), "/root")).toBe("npm");
  });
});

describe("detectWorkspaceKind", () => {
  it("detects pnpm workspaces with patterns", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n", "pnpm-lock.yaml": "" },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("pnpm");
    expect(result.packageManager).toBe("pnpm");
    expect(result.configPath).toBe("pnpm-workspace.yaml");
    expect(result.patterns).toEqual(["packages/*"]);
  });

  it("detects turbo workspaces", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "turbo.json": "{}", "yarn.lock": "" },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("turbo");
    expect(result.packageManager).toBe("yarn");
    expect(result.metadata).toEqual({});
  });

  it("detects lerna with package folders", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "lerna.json": '{"packages":["packages/*","apps/*"]}' },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("lerna");
    expect(result.patterns).toEqual(["packages/*", "apps/*"]);
  });

  it("detects rush projects", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "rush.json": '{"projects":[{"packageName":"a","projectFolder":"packages/a"}]}' },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("rush");
    expect(result.patterns).toEqual(["packages/a"]);
  });

  it("detects moonrepo projects", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "moon.yml": "projects:\n  - 'apps/*'\n  - 'packages/*'\n" },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("moonrepo");
    expect(result.patterns).toEqual(["apps/*", "packages/*"]);
  });

  it("detects npm workspaces from package.json", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": '{"workspaces":["packages/*"]}' },
    });
    const result = await detectWorkspaceKind(provider, "/root");
    expect(result.kind).toBe("npm");
    expect(result.configPath).toBe("package.json");
    expect(result.patterns).toEqual(["packages/*"]);
  });

  it("returns none when no workspace layout exists", async () => {
    const result = await detectWorkspaceKind(
      new MemoryProvider("/root", { files: { "package.json": "{}" } }),
      "/root",
    );
    expect(result).toMatchObject({ kind: "none", patterns: [] });
  });
});

describe("expandWorkspacePatterns", () => {
  it("expands glob patterns into relative dirs", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        "packages/a/package.json": "{}",
        "packages/b/package.json": "{}",
        "apps/web/package.json": "{}",
      },
    });
    const dirs = await expandWorkspacePatterns(provider, "/root", ["packages/*", "apps/*"]);
    expect(dirs).toEqual(["apps/web", "packages/a", "packages/b"]);
  });

  it("returns empty for no patterns", async () => {
    const provider = new MemoryProvider("/root", { files: { "a/x.ts": "x" } });
    expect(await expandWorkspacePatterns(provider, "/root", [])).toEqual([]);
  });
});
