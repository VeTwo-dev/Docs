import { describe, expect, it } from "vitest";
import { diffIndexes } from "./incremental.js";
import { createFileModel } from "../models/file.js";
import { createProjectModel } from "../models/project.js";
import type { FileModel } from "../models/file.js";

function file(
  relativePath: string,
  hash: string | undefined,
  size = 10,
  lastModified = 0,
): FileModel {
  return createFileModel({
    path: `/root/${relativePath}`,
    relativePath,
    name: relativePath.split("/").pop() ?? relativePath,
    extension: ".ts",
    dir: ".",
    size,
    lastModified,
    createdAt: 0,
    ...(hash !== undefined ? { hash } : {}),
    language: "typescript",
    category: "source",
    generated: false,
  });
}

function project(files: FileModel[]): ReturnType<typeof createProjectModel> {
  return createProjectModel({ name: "test", rootDir: "/root", files });
}

describe("diffIndexes", () => {
  it("detects added, removed, modified and unchanged files", () => {
    const previous = project([file("a.ts", "h1"), file("b.ts", "h2"), file("gone.ts", "h3")]);
    const current = project([file("a.ts", "h1"), file("b.ts", "h2b"), file("new.ts", "h4")]);
    const diff = diffIndexes(previous, current);
    expect(diff.added.map((f) => f.relativePath)).toEqual(["new.ts"]);
    expect(diff.removed.map((f) => f.relativePath)).toEqual(["gone.ts"]);
    expect(diff.modified.map((f) => f.relativePath)).toEqual(["b.ts"]);
    expect(diff.unchanged).toEqual(["a.ts"]);
    expect(diff.stats).toEqual({ added: 1, removed: 1, modified: 1, renamed: 0, unchanged: 1 });
  });

  it("detects renames via matching content hashes", () => {
    const previous = project([file("old.ts", "same-hash")]);
    const current = project([file("new.ts", "same-hash")]);
    const diff = diffIndexes(previous, current);
    expect(diff.renamed).toHaveLength(1);
    expect(diff.renamed[0]).toMatchObject({ from: "old.ts", to: "new.ts" });
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.stats.renamed).toBe(1);
  });

  it("does not pair renames without hashes", () => {
    const previous = project([file("old.ts", undefined, 10, 1)]);
    const current = project([file("new.ts", undefined, 10, 1)]);
    const diff = diffIndexes(previous, current);
    expect(diff.renamed).toHaveLength(0);
    expect(diff.added.map((f) => f.relativePath)).toEqual(["new.ts"]);
    expect(diff.removed.map((f) => f.relativePath)).toEqual(["old.ts"]);
  });

  it("compares size and mtime when hashes are absent", () => {
    const previous = project([file("a.ts", undefined, 10, 100)]);
    const unchanged = project([file("a.ts", undefined, 10, 100)]);
    const modified = project([file("a.ts", undefined, 12, 100)]);
    expect(diffIndexes(previous, unchanged).unchanged).toEqual(["a.ts"]);
    expect(diffIndexes(previous, modified).modified.map((f) => f.relativePath)).toEqual(["a.ts"]);
  });
});
