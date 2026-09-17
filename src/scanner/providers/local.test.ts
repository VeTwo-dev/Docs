import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileSystemProvider } from "./local.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "local-provider-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("LocalFileSystemProvider", () => {
  it("reports existence, types and stats", async () => {
    const provider = new LocalFileSystemProvider(dir);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;");

    expect(await provider.exists(join(dir, "src", "a.ts"))).toBe(true);
    expect(await provider.exists(join(dir, "missing"))).toBe(false);
    expect(await provider.isDirectory(join(dir, "src"))).toBe(true);
    expect(await provider.isDirectory(join(dir, "src", "a.ts"))).toBe(false);
    expect(await provider.isFile(join(dir, "src", "a.ts"))).toBe(true);
    expect(await provider.isFile(join(dir, "src"))).toBe(false);

    const stats = await provider.stat(join(dir, "src", "a.ts"));
    expect(stats?.type).toBe("file");
    expect(stats?.size).toBe(19);
    expect(typeof stats?.mtimeMs).toBe("number");
    expect(await provider.stat(join(dir, "missing"))).toBeUndefined();
  });

  it("lists directory entries with correct types", async () => {
    const provider = new LocalFileSystemProvider(dir);
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "file.txt"), "x");
    symlinkSync("file.txt", join(dir, "link.txt"));

    const entries = await provider.listDir(dir);
    expect(entries.find((e) => e.name === "sub")?.type).toBe("directory");
    expect(entries.find((e) => e.name === "file.txt")?.type).toBe("file");
    expect(entries.find((e) => e.name === "link.txt")?.type).toBe("symlink");
    expect(await provider.listDir(join(dir, "nope"))).toEqual([]);
  });

  it("reads files as text and bytes", async () => {
    const provider = new LocalFileSystemProvider(dir);
    writeFileSync(join(dir, "x.ts"), "hello");
    expect(await provider.readFile(join(dir, "x.ts"))).toBe("hello");
    expect(new TextDecoder().decode(await provider.readBytes(join(dir, "x.ts")))).toBe("hello");
  });

  it("glob matches files and directories", async () => {
    const provider = new LocalFileSystemProvider(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "src", "deep"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "a");
    writeFileSync(join(dir, "src", "deep", "b.ts"), "b");
    writeFileSync(join(dir, "other.js"), "c");

    const files = await provider.glob(["**/*.ts"], { cwd: dir });
    expect(files.map((f) => f.slice(dir.length))).toEqual(["/src/a.ts", "/src/deep/b.ts"]);

    const dirs = await provider.glob(["**"], { cwd: dir, onlyDirectories: true });
    expect(dirs.map((d) => d.slice(dir.length)).sort()).toEqual(["/src/", "/src/deep/"]);
  });

  it("resolves realpaths and read links", async () => {
    const provider = new LocalFileSystemProvider(dir);
    writeFileSync(join(dir, "real.txt"), "x");
    symlinkSync("real.txt", join(dir, "alias.txt"));
    expect(await provider.realpath(join(dir, "alias.txt"))).toBe(`${dir}/real.txt`);
    expect(await provider.readLink(join(dir, "alias.txt"))).toBe("real.txt");
    expect(await provider.readLink(join(dir, "not-a-link"))).toBeUndefined();
  });

  it("writes files and ensures directories", async () => {
    const provider = new LocalFileSystemProvider(dir);
    await provider.ensureDir(join(dir, "nested", "deep"));
    await provider.writeFile(join(dir, "nested", "deep", "out.ts"), "content");
    expect(await provider.isFile(join(dir, "nested", "deep", "out.ts"))).toBe(true);
    expect(await provider.readFile(join(dir, "nested", "deep", "out.ts"))).toBe("content");
  });

  it("defaults the root to the current working directory", () => {
    const provider = new LocalFileSystemProvider();
    expect(provider.name).toBe("local");
  });
});
