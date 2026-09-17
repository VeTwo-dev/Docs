import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import {
  manifestPathFor,
  readManifest,
  writeManifest,
  createManifest,
  mergeManifest,
} from "./io.js";
import type { WorkspaceManifest } from "../types/manifest.js";

describe("manifest io", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("computes the manifest path inside the state root", () => {
    expect(manifestPathFor(fs, "/project")).toBe("/project/.vetwo/docs/manifests/workspace.json");
  });

  it("returns undefined when the manifest is absent or malformed", () => {
    expect(readManifest(fs, "/project/.vetwo/docs/manifests/workspace.json")).toBeUndefined();
    fs.writeFile("/m.json", "{ not json");
    expect(readManifest(fs, "/m.json")).toBeUndefined();
    fs.writeFile("/m2.json", '{"schemaVersion":1}');
    expect(readManifest(fs, "/m2.json")).toBeUndefined();
  });

  it("reads a valid manifest", () => {
    const manifest: WorkspaceManifest = {
      schemaVersion: 1,
      skillVersion: 1,
      generatedBy: "@vetwo/docs",
      generatedAt: "2026-01-01",
      project: "acme",
      root: "/project",
      config: {
        outputDirectory: "docs",
        layout: { next: true, markdown: true, static: true },
        agentEnabled: true,
      },
      directories: ["docs"],
      files: [],
    };
    fs.writeFile("/m.json", JSON.stringify(manifest));
    expect(readManifest(fs, "/m.json")).toEqual(manifest);
  });

  it("writes a manifest", () => {
    const manifest: WorkspaceManifest = {
      schemaVersion: 1,
      skillVersion: 1,
      generatedBy: "@vetwo/docs",
      generatedAt: "2026-01-01",
      project: "acme",
      root: "/project",
      config: {
        outputDirectory: "docs",
        layout: { next: true, markdown: true, static: true },
        agentEnabled: true,
      },
      directories: ["docs"],
      files: [],
    };
    writeManifest(fs, "/m.json", manifest);
    expect(fs.readFile("/m.json")).toContain('"project": "acme"');
  });

  it("creates a fresh manifest", () => {
    const manifest = createManifest(
      {
        project: "acme",
        root: "/project",
        outputDirectory: "docs",
        layout: { next: true, markdown: true, static: true },
        agentEnabled: true,
      },
      "2026-01-01",
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generatedBy).toBe("@vetwo/docs");
    expect(manifest.config.outputDirectory).toBe("docs");
  });

  it("merges manifests keeping the union of files and directories", () => {
    const a: WorkspaceManifest = {
      schemaVersion: 1,
      skillVersion: 1,
      generatedBy: "@vetwo/docs",
      generatedAt: "2026-01-01",
      project: "acme",
      root: "/project",
      config: {
        outputDirectory: "docs",
        layout: { next: true, markdown: true, static: true },
        agentEnabled: true,
      },
      directories: ["docs/md"],
      files: [{ path: "docs/a.md", ownership: "system-generated" }],
    };
    const b: WorkspaceManifest = {
      ...a,
      directories: ["docs/next"],
      files: [
        { path: "docs/a.md", ownership: "system-managed" },
        { path: "docs/b.md", ownership: "system-generated" },
      ],
    };
    const merged = mergeManifest(a, b);
    expect(merged.directories).toEqual(["docs/md", "docs/next"]);
    expect(merged.files).toHaveLength(2);
    expect(merged.files.find((f) => f.path === "docs/a.md")?.ownership).toBe("system-managed");
  });

  it("mergeManifest returns the fresh manifest when no existing one exists", () => {
    const b: WorkspaceManifest = {
      schemaVersion: 1,
      skillVersion: 1,
      generatedBy: "@vetwo/docs",
      generatedAt: "2026-01-01",
      project: "acme",
      root: "/project",
      config: {
        outputDirectory: "docs",
        layout: { next: true, markdown: true, static: true },
        agentEnabled: true,
      },
      directories: [],
      files: [],
    };
    expect(mergeManifest(undefined, b)).toBe(b);
  });
});
