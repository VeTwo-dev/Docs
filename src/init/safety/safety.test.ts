import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import { resolveConflict } from "./conflicts.js";
import { classifyPath, isSystemOwned } from "./ownership.js";
import type { WorkspaceManifest } from "../types/manifest.js";
import type { ProposedOp } from "./conflicts.js";

function op(overrides: Partial<ProposedOp> & { path: string }): ProposedOp {
  return {
    desiredAction: "create",
    directory: false,
    ownership: "system-generated",
    ...overrides,
  };
}

describe("resolveConflict", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("creates missing paths", () => {
    const resolved = resolveConflict(fs, op({ path: "/new.txt" }));
    expect(resolved).toMatchObject({ action: "create", risk: "none", interactive: false });
  });

  it("preserves missing skip targets", () => {
    const resolved = resolveConflict(fs, op({ path: "/new.txt", desiredAction: "skip" }));
    expect(resolved.action).toBe("skip");
  });

  it("skips existing directories", () => {
    fs.mkdir("/dir");
    expect(resolveConflict(fs, op({ path: "/dir", directory: true })).action).toBe("skip");
    expect(resolveConflict(fs, op({ path: "/dir", desiredAction: "update" })).action).toBe("skip");
  });

  it("skips creating over system-owned files", () => {
    fs.writeFile("/f.txt", "x");
    const resolved = resolveConflict(fs, op({ path: "/f.txt", ownership: "system-managed" }));
    expect(resolved.action).toBe("skip");
  });

  it("flags conflicts when creating over user-owned files", () => {
    fs.writeFile("/f.txt", "x");
    const resolved = resolveConflict(fs, op({ path: "/f.txt", ownership: "user-authored" }));
    expect(resolved.action).toBe("conflict");
    expect(resolved.interactive).toBe(true);
    expect(resolved.risk).toBe("high");
  });

  it("updates system-managed files", () => {
    fs.writeFile("/f.txt", "x");
    const resolved = resolveConflict(
      fs,
      op({ path: "/f.txt", desiredAction: "update", ownership: "system-managed" }),
    );
    expect(resolved.action).toBe("update");
    expect(resolved.risk).toBe("low");
  });

  it("flags conflicts for system-generated and user-owned updates", () => {
    fs.writeFile("/a.txt", "x");
    fs.writeFile("/b.txt", "x");
    const generated = resolveConflict(
      fs,
      op({ path: "/a.txt", desiredAction: "update", ownership: "system-generated" }),
    );
    expect(generated.action).toBe("conflict");
    expect(generated.risk).toBe("medium");
    const user = resolveConflict(
      fs,
      op({ path: "/b.txt", desiredAction: "update", ownership: "user-authored" }),
    );
    expect(user.action).toBe("conflict");
    expect(user.risk).toBe("high");
  });

  it("merges existing files and skips when requested", () => {
    fs.writeFile("/m.txt", "x");
    expect(resolveConflict(fs, op({ path: "/m.txt", desiredAction: "merge" })).action).toBe(
      "merge",
    );
    expect(resolveConflict(fs, op({ path: "/m.txt", desiredAction: "skip" })).action).toBe("skip");
    expect(resolveConflict(fs, op({ path: "/m.txt", desiredAction: "warn" })).action).toBe("warn");
  });

  it("handles unknown desired actions as conflicts", () => {
    fs.writeFile("/u.txt", "x");
    const resolved = resolveConflict(fs, op({ path: "/u.txt", desiredAction: "mystery" as never }));
    expect(resolved.action).toBe("conflict");
  });
});

describe("classifyPath", () => {
  let fs: MemorySafeFileSystem;
  let manifest: WorkspaceManifest;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
    manifest = {
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
      files: [{ path: "docs/config.md", ownership: "system-managed", template: "config" }],
    };
  });

  it("classifies missing paths as system-generated", () => {
    expect(
      classifyPath({ fs, root: "/project", manifest, path: "/project/new.txt" }).ownership,
    ).toBe("system-generated");
  });

  it("honours manifest ownership for user-authored entries", () => {
    const withUserFile: WorkspaceManifest = {
      ...manifest,
      files: [...manifest.files, { path: "docs/user.md", ownership: "user-authored" }],
    };
    fs.writeFile("/project/docs/user.md", "x");
    const result = classifyPath({
      fs,
      root: "/project",
      manifest: withUserFile,
      path: "/project/docs/user.md",
    });
    expect(result.ownership).toBe("user-authored");
    expect(result.reason).toContain("Manifest records");
  });

  it("promotes modified generated files to user-modified-generated", () => {
    fs.writeFile("/project/docs/config.md", "user edits");
    const result = classifyPath({
      fs,
      root: "/project",
      manifest,
      path: "/project/docs/config.md",
      expectedTemplate: "original",
    });
    expect(result.ownership).toBe("user-modified-generated");
  });

  it("keeps manifest ownership when content is unchanged", () => {
    fs.writeFile("/project/docs/config.md", "original");
    const result = classifyPath({
      fs,
      root: "/project",
      manifest,
      path: "/project/docs/config.md",
      expectedTemplate: "original",
    });
    expect(result.ownership).toBe("system-managed");
  });

  it("classifies untracked files matching the template as system-generated", () => {
    fs.writeFile("/project/gen.md", "template");
    const result = classifyPath({
      fs,
      root: "/project",
      manifest,
      path: "/project/gen.md",
      expectedTemplate: "template",
    });
    expect(result.ownership).toBe("system-generated");
  });

  it("classifies untracked differing files as user-authored", () => {
    fs.writeFile("/project/gen.md", "user content");
    const result = classifyPath({
      fs,
      root: "/project",
      manifest,
      path: "/project/gen.md",
      expectedTemplate: "template",
    });
    expect(result.ownership).toBe("user-authored");
  });

  it("treats untracked paths without a template as user-authored", () => {
    fs.writeFile("/project/other.md", "x");
    const result = classifyPath({ fs, root: "/project", manifest, path: "/project/other.md" });
    expect(result.ownership).toBe("user-authored");
  });

  it("works without a manifest", () => {
    fs.writeFile("/project/other.md", "x");
    expect(
      classifyPath({ fs, root: "/project", manifest: undefined, path: "/project/other.md" })
        .ownership,
    ).toBe("user-authored");
  });

  it("isSystemOwned recognises managed and generated ownership", () => {
    expect(isSystemOwned("system-managed")).toBe(true);
    expect(isSystemOwned("system-generated")).toBe(true);
    expect(isSystemOwned("user-authored")).toBe(false);
    expect(isSystemOwned("unknown")).toBe(false);
  });
});
