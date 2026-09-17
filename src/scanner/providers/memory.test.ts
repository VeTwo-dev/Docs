import { describe, expect, it } from "vitest";
import { MemoryProvider } from "./memory.js";

describe("MemoryProvider", () => {
  it("resolves absolute and relative paths against the root", async () => {
    const provider = new MemoryProvider("/root", { files: { "src/a.ts": "export const a = 1;" } });
    expect(await provider.exists("src/a.ts")).toBe(true);
    expect(await provider.exists("/root/src/a.ts")).toBe(true);
    expect(await provider.exists("/root/src/a.ts")).toBe(true);
  });

  it("reports implicit directories", async () => {
    const provider = new MemoryProvider("/root", { files: { "a/b/c.ts": "x" } });
    expect(await provider.isDirectory("a")).toBe(true);
    expect(await provider.isDirectory("a/b")).toBe(true);
    expect(await provider.isDirectory("a/b/c.ts")).toBe(false);
    expect(await provider.isFile("a/b/c.ts")).toBe(true);
    expect(await provider.exists("a")).toBe(true);
    expect(await provider.exists("missing")).toBe(false);
  });

  it("stats files, directories and symlinks", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "file.txt": "hello", "a/b.txt": "x" },
      symlinks: [{ path: "link.txt", target: "file.txt" }],
      mtimeMs: 12345,
    });
    const fileStat = await provider.stat("file.txt");
    expect(fileStat).toMatchObject({ type: "file", size: 5, mtimeMs: 12345 });
    const dirStat = await provider.stat("a");
    expect(dirStat?.type).toBe("directory");
    const linkStat = await provider.stat("link.txt");
    expect(linkStat?.type).toBe("symlink");
    expect(await provider.stat("missing")).toBeUndefined();
  });

  it("lists directory entries", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "src/a.ts": "a", "src/b.ts": "b", "src/nested/c.ts": "c", "top.ts": "t" },
    });
    const entries = await provider.listDir("src");
    expect(entries.map((e) => e.name)).toEqual(["a.ts", "b.ts", "nested"]);
    expect(entries.find((e) => e.name === "nested")?.type).toBe("directory");
    expect(entries.find((e) => e.name === "nested")?.path).toBe("/root/src/nested");
  });

  it("reads files as text and bytes", async () => {
    const provider = new MemoryProvider("/root", { files: { "x.ts": "hello" } });
    expect(await provider.readFile("x.ts")).toBe("hello");
    expect(new TextDecoder().decode(await provider.readBytes("x.ts"))).toBe("hello");
    await expect(provider.readFile("missing")).rejects.toThrow(/ENOENT/);
  });

  it("glob matches relative patterns", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "src/a.ts": "a", "src/b.js": "b", "src/deep/c.ts": "c", "test.ts": "t" },
    });
    const files = await provider.glob(["src/**/*.ts"]);
    expect(files).toEqual(["/root/src/a.ts", "/root/src/deep/c.ts"]);
    const dirs = await provider.glob(["**"], { onlyDirectories: true });
    expect(dirs).toEqual(["/root/src", "/root/src/deep"]);
  });

  it("resolves symlinks and fails on broken targets", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "real.txt": "x" },
      symlinks: [
        { path: "good", target: "real.txt" },
        { path: "bad", target: "missing.txt" },
      ],
    });
    expect(await provider.realpath("good")).toBe("/root/real.txt");
    await expect(provider.realpath("bad")).rejects.toThrow(/ENOENT/);
    expect(await provider.readLink("good")).toBe("real.txt");
    expect(await provider.realpath("real.txt")).toBe("/root/real.txt");
    await expect(provider.realpath("missing")).rejects.toThrow(/ENOENT/);
  });

  it("writes files", async () => {
    const provider = new MemoryProvider("/root");
    await provider.writeFile("new.ts", "x");
    expect(await provider.readFile("new.ts")).toBe("x");
    await provider.ensureDir("whatever");
  });
});
