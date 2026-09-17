import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import { initializeDocumentationWorkspace } from "./index.js";

const ROOT = "/project";

function makeFs(): MemorySafeFileSystem {
  const fs = new MemorySafeFileSystem();
  fs.writeFile("/project/package.json", '{"name": "acme", "version": "1.0.0"}');
  return fs;
}

let silent: () => void;

beforeEach(() => {
  silent = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  silent();
  vi.restoreAllMocks();
});

describe("initializeDocumentationWorkspace", () => {
  it("scaffolds the workspace and records created paths", async () => {
    const fs = makeFs();
    const result = await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });

    expect(fs.isFile(`${ROOT}/docs.config.ts`)).toBe(true);
    expect(fs.isFile(`${ROOT}/agent/skill.md`)).toBe(true);
    expect(fs.isFile(`${ROOT}/docs/md/README.md`)).toBe(true);
    expect(fs.isFile(`${ROOT}/docs/next/package.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/docs/static/README.md`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/manifests/workspace.json`)).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
    expect(result.dryRun).toBe(false);
  });

  it("initializes the internal state root and ignores it in git", async () => {
    const fs = makeFs();
    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });

    expect(fs.isFile(`${ROOT}/.vetwo/docs/state.json`)).toBe(true);
    const state = JSON.parse(fs.readFile(`${ROOT}/.vetwo/docs/state.json`)) as {
      project: string;
      namespaces: Record<string, { active?: boolean }>;
    };
    expect(state.project).toBe("acme");
    expect(state.namespaces["manifests"]?.active).toBe(true);

    const gitignore = fs.isFile(`${ROOT}/.gitignore`) ? fs.readFile(`${ROOT}/.gitignore`) : "";
    expect(gitignore).toContain(".vetwo/docs/");
  });

  it("is idempotent: a second run merges rather than duplicates", async () => {
    const fs = makeFs();
    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    const second = await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });

    const config = fs.readFile(`${ROOT}/docs.config.ts`);
    expect(config.match(/output:/g)).toHaveLength(1);
    expect(config.match(/agent:/g)).toHaveLength(1);
    expect(second.merged).toContain(`${ROOT}/agent/skill.md`);
  });

  it("never overwrites user-authored files", async () => {
    const fs = makeFs();
    const userDoc = "# My Handwritten Docs";
    fs.writeFile(`${ROOT}/docs/md/index.md`, userDoc);

    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    expect(fs.readFile(`${ROOT}/docs/md/index.md`)).toBe(userDoc);
  });

  it("does not write anything in dry-run mode", async () => {
    const fs = makeFs();
    const result = await initializeDocumentationWorkspace({ rootDir: ROOT, fs, dryRun: true });

    expect(fs.isFile(`${ROOT}/docs.config.ts`)).toBe(false);
    expect(fs.isFile(`${ROOT}/agent/skill.md`)).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("honours an existing config's output directory", async () => {
    const fs = makeFs();
    fs.writeFile(
      `${ROOT}/docs.config.ts`,
      'export default defineDocs({ output: { directory: "wiki", layout: { next: true, markdown: true, static: true } } });',
    );

    const result = await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    expect(fs.isFile(`${ROOT}/wiki/md/README.md`)).toBe(true);
    expect(result.outputPath).toContain("wiki");
  });

  it("extracts a legacy string output from an existing config", async () => {
    const fs = makeFs();
    fs.writeFile(`${ROOT}/docs.config.ts`, 'export default defineDocs({ output: "./docs-site" });');

    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    expect(fs.isFile(`${ROOT}/docs-site/md/README.md`)).toBe(true);
  });

  it("an existing config's output directory wins over the --output flag", async () => {
    const fs = makeFs();
    fs.writeFile(
      `${ROOT}/docs.config.ts`,
      'export default defineDocs({ output: { directory: "wiki", layout: { next: true, markdown: true, static: true } } });',
    );

    const result = await initializeDocumentationWorkspace({
      rootDir: ROOT,
      fs,
      yes: true,
      outputDirectory: "docs",
    });
    expect(fs.isFile(`${ROOT}/wiki/md/README.md`)).toBe(true);
    expect(fs.isDirectory(`${ROOT}/docs`)).toBe(false);
    expect(result.outputPath).toContain("wiki");
  });

  it("does not prompt or overwrite user-modified files in non-interactive mode", async () => {
    const fs = makeFs();
    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    const modified = "# I modified the generated skill\n\nThis is my content.\n";
    fs.writeFile(`${ROOT}/agent/skill.md`, modified);

    const result = await initializeDocumentationWorkspace({
      rootDir: ROOT,
      fs,
      nonInteractive: true,
    });
    expect(fs.readFile(`${ROOT}/agent/skill.md`)).toBe(modified);
    expect(result.created.length).toBe(0);
    expect(result.merged.length).toBe(0);
    expect(result.conflicts.length).toBe(0);
    expect(result.preserved.length).toBeGreaterThan(0);
    expect(result.dryRun).toBe(false);
  });

  it("preserves a user-owned skill file when ownership is respected", async () => {
    const fs = makeFs();
    fs.writeFile(`${ROOT}/agent/skill.md`, "# User-owned skill, keep me");

    await initializeDocumentationWorkspace({ rootDir: ROOT, fs, yes: true });
    expect(fs.readFile(`${ROOT}/agent/skill.md`)).toContain("User-owned skill");
  });
});
