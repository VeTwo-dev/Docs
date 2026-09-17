import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import {
  DEFAULT_STATE_IGNORE_RULE,
  getGitignorePath,
  readGitignore,
  isStateIgnored,
  ensureStateIgnored,
} from "./gitignore.js";

const ROOT = "/project";

describe("state/gitignore", () => {
  let fs: MemorySafeFileSystem;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("resolves the gitignore path", () => {
    expect(getGitignorePath(ROOT)).toBe("/project/.gitignore");
  });

  it("reads empty content when .gitignore is absent", () => {
    expect(readGitignore(fs, ROOT)).toBe("");
  });

  it("detects when the state root is already ignored", () => {
    expect(isStateIgnored(`node_modules\n${DEFAULT_STATE_IGNORE_RULE}\n`)).toBe(true);
    expect(isStateIgnored("dist\n.vetwo/\n")).toBe(true);
    expect(isStateIgnored("dist\n.vetwo\n")).toBe(true);
    expect(isStateIgnored("dist\n/.vetwo/docs/\n")).toBe(true);
    expect(isStateIgnored("dist\n")).toBe(false);
  });

  it("creates a .gitignore with the state rule when missing", () => {
    const result = ensureStateIgnored(fs, ROOT);
    expect(result.ruleAdded).toBe(true);
    expect(result.rule).toBe(DEFAULT_STATE_IGNORE_RULE);
    expect(result.gitignorePath).toBe("/project/.gitignore");
    expect(isStateIgnored(readGitignore(fs, ROOT))).toBe(true);

    const again = ensureStateIgnored(fs, ROOT);
    expect(again.ruleAdded).toBe(false);
  });

  it("appends the rule to an existing .gitignore", () => {
    fs.writeFile("/project/.gitignore", "node_modules\ndist\n");
    ensureStateIgnored(fs, ROOT);
    const content = readGitignore(fs, ROOT);
    expect(content).toContain("node_modules");
    expect(content).toContain("dist");
    expect(isStateIgnored(content)).toBe(true);
  });

  it("does not duplicate rules when already covered", () => {
    fs.writeFile("/project/.gitignore", "node_modules\n.vetwo/\n");
    const result = ensureStateIgnored(fs, ROOT);
    expect(result.ruleAdded).toBe(false);
    expect(readGitignore(fs, ROOT)).toBe("node_modules\n.vetwo/\n");
  });

  it("respects dry-run mode without writing", () => {
    const result = ensureStateIgnored(fs, ROOT, { dryRun: true });
    expect(result.ruleAdded).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(fs.isFile("/project/.gitignore")).toBe(false);
  });

  it("appends only once across repeated runs", () => {
    fs.writeFile("/project/.gitignore", "# user file\n.dist\n");
    ensureStateIgnored(fs, ROOT);
    const once = readGitignore(fs, ROOT);
    ensureStateIgnored(fs, ROOT);
    expect(readGitignore(fs, ROOT)).toBe(once);
    expect(isStateIgnored(once)).toBe(true);
  });
});
