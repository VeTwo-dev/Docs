import { describe, expect, it } from "vitest";
import type { ProjectModel } from "../../scanner/models/project.js";
import { detectionInputFromProjectModel, fingerprintDetectionInput } from "./detection.js";

describe("fingerprintDetectionInput", () => {
  it("is stable regardless of key and array order", () => {
    const a = fingerprintDetectionInput({
      files: ["b.ts", "a.ts"],
      dependencies: { react: "^18" },
      workspace: { packages: ["pkg-b", "pkg-a"] },
    });
    const b = fingerprintDetectionInput({
      dependencies: { react: "^18" },
      files: ["a.ts", "b.ts"],
      workspace: { packages: ["pkg-a", "pkg-b"] },
    });
    expect(a).toBe(b);
  });

  it("distinguishes different inputs", () => {
    const a = fingerprintDetectionInput({ files: ["a.ts"] });
    const b = fingerprintDetectionInput({ files: ["b.ts"] });
    expect(a).not.toBe(b);
  });
});

describe("detectionInputFromProjectModel", () => {
  const model = {
    rootPath: "/tmp/project",
    packageManager: "pnpm",
    files: [
      { name: "index.ts", relativePath: "src/index.ts", extension: ".ts" },
      { name: "tsconfig.json", relativePath: "tsconfig.json", extension: ".json" },
      { name: "pnpm-lock.yaml", relativePath: "pnpm-lock.yaml", extension: ".yaml" },
      { name: "README.md", relativePath: "README.md", extension: ".md" },
    ],
    configurations: [{ file: { name: "tsconfig.json" } }],
    packages: [
      { name: "root", isWorkspaceRoot: true, dependencies: { next: "^15" }, devDependencies: {} },
    ],
    workspaces: [{ packages: ["packages/*"] }],
  } as unknown as ProjectModel;

  it("derives files, extensions, configs, lockfiles and dependencies", () => {
    const input = detectionInputFromProjectModel(model);
    expect(input.rootDir).toBe("/tmp/project");
    expect(input.files).toContain("src/index.ts");
    expect(input.extensions).toContain(".ts");
    expect(input.extensions).toContain(".md");
    expect(input.configFiles).toEqual(["tsconfig.json"]);
    expect(input.lockfiles).toContain("pnpm-lock.yaml");
    expect(input.dependencies).toEqual({ next: "^15" });
  });

  it("maps workspace metadata", () => {
    const input = detectionInputFromProjectModel(model);
    expect(input.workspace).toEqual({
      manager: "pnpm",
      packages: ["packages/*"],
      monorepo: false,
    });
  });

  it("handles models without packages or workspaces", () => {
    const bare = {
      rootPath: "/tmp/x",
      files: [],
      configurations: [],
      packages: [],
      workspaces: [],
    } as unknown as ProjectModel;
    const input = detectionInputFromProjectModel(bare);
    expect(input.files).toEqual([]);
    expect(input.extensions).toEqual([]);
    expect(input.dependencies).toBeUndefined();
    expect(input.workspace).toBeUndefined();
    expect(input.lockfiles).toEqual([]);
  });
});
