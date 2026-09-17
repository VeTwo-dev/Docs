import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemorySafeFileSystem } from "./memory.js";
import { NodeSafeFileSystem } from "./node.js";
import { safeCreate, safeCreateFile, safeWrite, safeCopy, safeMkdir, safeRemove } from "./safe.js";
import { normalizePath, posixJoin, posixRelative, posixResolve } from "./interface.js";

describe("path helpers", () => {
  it("normalises backslashes and repeated slashes", () => {
    expect(normalizePath("a\\b//c")).toBe("a/b/c");
  });

  it("joins, resolves and relativises paths", () => {
    expect(posixJoin("/a", "b", "c")).toBe("/a/b/c");
    expect(posixResolve("/a", "b")).toBe("/a/b");
    expect(posixRelative("/a", "/a/b")).toBe("b");
  });
});

describe("MemorySafeFileSystem", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("creates, reads and lists files with implicit directories", () => {
    fs.writeFile("/project/README.md", "# Hello");
    fs.writeFile("/project/src/index.ts", "export const x = 1;");
    expect(fs.exists("/project/README.md")).toBe(true);
    expect(fs.isFile("/project/README.md")).toBe(true);
    expect(fs.isDirectory("/project")).toBe(true);
    expect(fs.isDirectory("/project/src")).toBe(true);
    expect(fs.readFile("/project/README.md")).toBe("# Hello");
    expect(fs.listDir("/project")).toEqual(["README.md", "src"]);
    expect(fs.listFiles("/project")).toEqual(["README.md", "src/index.ts"]);
  });

  it("resolves, relativises and joins via the seam", () => {
    expect(fs.resolve("/a", "b")).toBe("/a/b");
    expect(fs.relative("/a", "/a/b/c")).toBe("b/c");
    expect(fs.join("/a", "b")).toBe("/a/b");
  });

  it("reports missing paths as non-existent", () => {
    expect(fs.exists("/nope")).toBe(false);
    expect(fs.isFile("/nope")).toBe(false);
    expect(fs.isDirectory("/nope")).toBe(false);
    expect(fs.listDir("/nope")).toEqual([]);
    expect(() => fs.readFile("/nope")).toThrow(/File not found/);
  });

  it("mkdir creates directories and parent prefixes", () => {
    fs.mkdir("/a/b/c");
    expect(fs.isDirectory("/a/b/c")).toBe(true);
    expect(fs.isDirectory("/a/b")).toBe(true);
    expect(fs.isDirectory("/a")).toBe(true);
  });

  it("copyFile copies content", () => {
    fs.writeFile("/a.txt", "content");
    fs.copyFile("/a.txt", "/b.txt");
    expect(fs.readFile("/b.txt")).toBe("content");
  });

  it("remove deletes files, directory trees and fires listeners", () => {
    const events: string[] = [];
    fs.onWrite((path, kind) => events.push(`${kind}:${path}`));
    fs.writeFile("/dir/a.txt", "a");
    fs.writeFile("/dir/sub/b.txt", "b");
    expect(fs.remove("/dir/a.txt")).toBe(true);
    expect(fs.remove("/dir")).toBe(true);
    expect(fs.exists("/dir")).toBe(false);
    expect(fs.remove("/dir")).toBe(false);
    expect(events.length).toBe(4);
  });

  it("snapshot exposes stored content", () => {
    fs.writeFile("/a.txt", "x");
    expect([...fs.snapshot().entries()]).toEqual([["/a.txt", "x"]]);
  });

  it("failOn simulates write failures and clearFailures resets them", () => {
    fs.failOn(/protected/);
    expect(() => fs.writeFile("/protected.txt", "x")).toThrow(/Simulated write failure/);
    fs.clearFailures();
    fs.writeFile("/protected.txt", "x");
    expect(fs.readFile("/protected.txt")).toBe("x");
  });
});

describe("NodeSafeFileSystem", () => {
  let dir: string;
  let fs: NodeSafeFileSystem;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vetwo-fs-"));
    fs = new NodeSafeFileSystem();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates, writes, reads and copies files", () => {
    fs.writeFile(join(dir, "sub/file.txt"), "hello");
    expect(fs.exists(join(dir, "sub/file.txt"))).toBe(true);
    expect(fs.isFile(join(dir, "sub/file.txt"))).toBe(true);
    expect(fs.isDirectory(join(dir, "sub"))).toBe(true);
    expect(fs.readFile(join(dir, "sub/file.txt"))).toBe("hello");
    fs.copyFile(join(dir, "sub/file.txt"), join(dir, "copy.txt"));
    expect(fs.readFile(join(dir, "copy.txt"))).toBe("hello");
  });

  it("listFiles walks directories and sorts", () => {
    mkdirSync(join(dir, "a"), { recursive: true });
    writeFileSync(join(dir, "a/b.ts"), "");
    writeFileSync(join(dir, "c.ts"), "");
    const files = fs.listFiles(dir);
    expect(files).toEqual(["a/b.ts", "c.ts"]);
    expect(fs.listFiles(join(dir, "missing"))).toEqual([]);
  });

  it("remove returns false for missing paths and true otherwise", () => {
    expect(fs.remove(join(dir, "nope"))).toBe(false);
    writeFileSync(join(dir, "f.txt"), "x");
    expect(fs.remove(join(dir, "f.txt"))).toBe(true);
  });

  it("handles missing files and directories gracefully", () => {
    expect(fs.isFile(join(dir, "nope.ts"))).toBe(false);
    expect(fs.isDirectory(join(dir, "nope"))).toBe(false);
    expect(fs.listDir(join(dir, "nope"))).toEqual([]);
  });
});

describe("safe operations", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  function throwingFs(overrides: { mkdir?: boolean; remove?: boolean } = {}): typeof fs {
    const base = new MemorySafeFileSystem();
    const stub: typeof fs = {
      resolve: (...parts: readonly string[]) => base.resolve(parts[0]!, ...parts.slice(1)),
      relative: (from: string, to: string) => base.relative(from, to),
      join: (...parts: readonly string[]) => base.join(...parts),
      exists: (path: string) => base.exists(path),
      isFile: (path: string) => base.isFile(path),
      isDirectory: (path: string) => base.isDirectory(path),
      mkdir: overrides.mkdir
        ? () => {
            throw new Error("mkdir failed");
          }
        : (dir: string) => base.mkdir(dir),
      writeFile: (file: string, content: string) => base.writeFile(file, content),
      readFile: (file: string) => base.readFile(file),
      copyFile: (from: string, to: string) => base.copyFile(from, to),
      remove: overrides.remove
        ? () => {
            throw new Error("remove failed");
          }
        : (path: string) => base.remove(path),
      listDir: (dir: string) => base.listDir(dir),
      listFiles: (root: string) => base.listFiles(root),
    };
    return stub;
  }

  it("safeCreate creates new files and skips existing ones", () => {
    expect(safeCreate("/a.txt", "x", { fs })).toEqual({
      ok: true,
      action: "created",
    });
    const existing = safeCreate("/a.txt", "y", { fs });
    expect(existing.ok).toBe(false);
    expect(existing.action).toBe("skipped");
  });

  it("safeCreate reports I/O errors", () => {
    fs.failOn(/boom/);
    const result = safeCreate("/boom.txt", "x", { fs });
    expect(result.ok).toBe(false);
    expect(result.action).toBe("error");
    expect(result.reason).toContain("Simulated");
  });

  it("safeCreateFile is an alias for safeCreate", () => {
    expect(safeCreateFile("/b.txt", "x", { fs }).ok).toBe(true);
  });

  it("safeWrite creates missing files and updates system-owned content", () => {
    expect(safeWrite("/a.txt", "v1", { fs, expectedOwnership: "system-managed" }).action).toBe(
      "created",
    );
    expect(safeWrite("/a.txt", "v2", { fs, expectedOwnership: "system-managed" }).action).toBe(
      "updated",
    );
    expect(safeWrite("/a.txt", "v3", { fs, expectedOwnership: "system-generated" }).action).toBe(
      "updated",
    );
  });

  it("safeWrite refuses to overwrite non-system content", () => {
    fs.writeFile("/a.txt", "user");
    const result = safeWrite("/a.txt", "new", { fs, expectedOwnership: "user-authored" });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Refusing to overwrite");
  });

  it("safeWrite reports I/O errors on existing files", () => {
    fs.writeFile("/a.txt", "x");
    fs.failOn(/a\.txt$/);
    const result = safeWrite("/a.txt", "y", { fs, expectedOwnership: "system-managed" });
    expect(result.ok).toBe(false);
    expect(result.action).toBe("error");
  });

  it("safeCopy never overwrites existing targets", () => {
    fs.writeFile("/src.txt", "s");
    expect(safeCopy("/src.txt", "/dst.txt", { fs }).ok).toBe(true);
    expect(safeCopy("/src.txt", "/dst.txt", { fs }).action).toBe("skipped");
    expect(safeCopy("/missing.txt", "/x.txt", { fs }).action).toBe("error");
  });

  it("safeMkdir creates directories and preserves existing ones", () => {
    expect(safeMkdir("/a", { fs }).action).toBe("created");
    expect(safeMkdir("/a", { fs }).action).toBe("preserved");
    fs.writeFile("/f.txt", "x");
    const notDir = safeMkdir("/f.txt", { fs });
    expect(notDir.action).toBe("skipped");
    expect(safeMkdir("/boom", { fs: throwingFs({ mkdir: true }) }).action).toBe("error");
  });

  it("safeRemove removes files and empty dirs only", () => {
    fs.writeFile("/a.txt", "x");
    expect(safeRemove("/a.txt", { fs }).action).toBe("updated");
    expect(safeRemove("/a.txt", { fs }).action).toBe("skipped");
    fs.writeFile("/dir/f.txt", "x");
    expect(safeRemove("/dir", { fs }).action).toBe("skipped");
    fs.writeFile("/lock.txt", "x");
    const originalRemove = fs.remove;
    fs.remove = () => {
      throw new Error("remove failed");
    };
    expect(safeRemove("/lock.txt", { fs }).action).toBe("error");
    fs.remove = originalRemove;
  });
});
