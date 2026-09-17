import { describe, expect, it } from "vitest";
import {
  classifyProject,
  coarseProjectType,
  normalizePackageManager,
} from "./project-classifier.js";
import type { ProjectClassificationInput } from "./types.js";

function input(overrides: Partial<ProjectClassificationInput> = {}): ProjectClassificationInput {
  return {
    name: "my-project",
    keywords: [],
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    scripts: {},
    isRootPackage: true,
    hasWorkspaces: false,
    packageCount: 1,
    ...overrides,
  };
}

describe("classifyProject", () => {
  it("classifies monorepos", () => {
    const result = classifyProject(input({ hasWorkspaces: true }));
    expect(result).toContain("monorepo");
  });

  it("classifies monorepos by package count", () => {
    const result = classifyProject(input({ packageCount: 3 }));
    expect(result).toContain("monorepo");
  });

  it("classifies applications by dependencies", () => {
    const result = classifyProject(input({ dependencies: { next: "^14.0.0" } }));
    expect(result).toContain("application");
    const server = classifyProject(input({ dependencies: { express: "^4" } }));
    expect(server).toContain("application");
  });

  it("classifies by keywords and name", () => {
    expect(classifyProject(input({ keywords: ["framework"] }))).toContain("framework");
    expect(classifyProject(input({ keywords: ["cli"] }))).toContain("cli");
    expect(classifyProject(input({ name: "docs-plugin" }))).toContain("plugin");
    expect(classifyProject(input({ name: "sdk" }))).toContain("sdk");
    expect(classifyProject(input({ name: "react-template" }))).toContain("template");
    expect(classifyProject(input({ name: "some-tool" }))).toContain("tooling");
  });

  it("classifies library projects with build scripts", () => {
    const result = classifyProject(input({ scripts: { build: "tsup" } }));
    expect(result).toContain("library");
    const docsBuild = classifyProject(input({ scripts: { "build:docs": "docs build" } }));
    expect(docsBuild).toContain("library");
  });

  it("does not mark apps or frameworks as libraries", () => {
    const app = classifyProject(
      input({ dependencies: { next: "^14" }, scripts: { build: "next build" } }),
    );
    expect(app).not.toContain("library");
    const fw = classifyProject(input({ keywords: ["framework"], scripts: { build: "x" } }));
    expect(fw).not.toContain("library");
  });

  it("falls back to unknown", () => {
    expect(classifyProject(input())).toEqual(["unknown"]);
  });
});

describe("coarseProjectType", () => {
  it("maps rich classifications to coarse types", () => {
    expect(coarseProjectType(["monorepo"])).toBe("monorepo");
    expect(coarseProjectType(["application"])).toBe("application");
    expect(coarseProjectType(["unknown"])).toBe("unknown");
    expect(coarseProjectType(["library"])).toBe("library");
    expect(coarseProjectType(["framework", "library"])).toBe("library");
  });
});

describe("normalizePackageManager", () => {
  it("normalises known managers", () => {
    expect(normalizePackageManager("pnpm")).toBe("pnpm");
    expect(normalizePackageManager("yarn")).toBe("yarn");
    expect(normalizePackageManager("bun")).toBe("bun");
    expect(normalizePackageManager("npm")).toBe("npm");
  });

  it("falls back for unknown values", () => {
    expect(normalizePackageManager("cargo")).toBe("npm");
    expect(normalizePackageManager(undefined, "yarn")).toBe("yarn");
  });
});
