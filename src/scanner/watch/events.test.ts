import { describe, expect, it } from "vitest";
import { classifyWatchEvent, isConfigurationPath } from "./events.js";
import { createPackageModel } from "../models/package.js";
import { createWorkspaceModel } from "../models/workspace.js";
import type { RawWatchEvent } from "../types/events.js";

const pkg = createPackageModel({
  path: "/root/packages/a",
  relativePath: "packages/a",
  name: "a",
  manifestPath: "/root/packages/a/package.json",
  manifestRelativePath: "packages/a/package.json",
  isWorkspaceRoot: false,
});

const ws = createWorkspaceModel({
  name: "pnpm",
  path: "/root",
  relativePath: ".",
  kind: "pnpm",
  packageManager: "pnpm",
  configPath: "pnpm-workspace.yaml",
  patterns: ["packages/*"],
});

function raw(type: RawWatchEvent["type"], path: string): RawWatchEvent {
  return { type, path };
}

describe("classifyWatchEvent", () => {
  const context = { rootDir: "/root", packages: [pkg], workspaces: [ws] };

  it("classifies file events", () => {
    expect(classifyWatchEvent(raw("add", "/root/src/new.ts"), context).type).toBe("file-added");
    expect(classifyWatchEvent(raw("change", "/root/src/new.ts"), context).type).toBe(
      "file-modified",
    );
    expect(classifyWatchEvent(raw("unlink", "/root/src/gone.ts"), context).type).toBe(
      "file-removed",
    );
    expect(classifyWatchEvent(raw("addDir", "/root/src/deep"), context).type).toBe(
      "directory-added",
    );
    expect(classifyWatchEvent(raw("unlinkDir", "/root/src/deep"), context).type).toBe(
      "directory-removed",
    );
  });

  it("computes relative paths and timestamps", () => {
    const event = classifyWatchEvent(raw("add", "/root/src/new.ts"), context);
    expect(event.relativePath).toBe("src/new.ts");
    expect(event.path).toBe("/root/src/new.ts");
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("classifies package manifest events", () => {
    expect(classifyWatchEvent(raw("add", "/root/packages/a/package.json"), context).type).toBe(
      "package-added",
    );
    expect(classifyWatchEvent(raw("change", "/root/packages/a/package.json"), context).type).toBe(
      "package-modified",
    );
    expect(classifyWatchEvent(raw("unlink", "/root/packages/a/package.json"), context).type).toBe(
      "package-removed",
    );
    expect(classifyWatchEvent(raw("add", "/root/packages/a/package.json"), context).subject).toBe(
      "a",
    );
  });

  it("classifies workspace manifest events", () => {
    expect(classifyWatchEvent(raw("change", "/root/pnpm-workspace.yaml"), context).type).toBe(
      "workspace-changed",
    );
  });

  it("classifies configuration events", () => {
    expect(classifyWatchEvent(raw("change", "/root/tsconfig.json"), context).type).toBe(
      "configuration-changed",
    );
    expect(classifyWatchEvent(raw("change", "/root/vite.config.ts"), context).type).toBe(
      "configuration-changed",
    );
    expect(classifyWatchEvent(raw("change", "/root/README.md"), context).type).toBe(
      "file-modified",
    );
  });
});

describe("isConfigurationPath", () => {
  it("matches known config names", () => {
    expect(isConfigurationPath("tsconfig.json")).toBe(true);
    expect(isConfigurationPath("eslint.config.mjs")).toBe(true);
    expect(isConfigurationPath(".github/workflows/ci.yml")).toBe(true);
    expect(isConfigurationPath(".prettierrc")).toBe(true);
    expect(isConfigurationPath("Dockerfile")).toBe(true);
    expect(isConfigurationPath("src/App.tsx")).toBe(false);
  });
});
