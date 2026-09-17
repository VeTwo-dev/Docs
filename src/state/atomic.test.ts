import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import { atomicWriteFile, atomicWriteJson } from "./atomic.js";

describe("state/atomic", () => {
  let fs: MemorySafeFileSystem;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("writes a file atomically, leaving no temp sibling behind", () => {
    atomicWriteFile(fs, "/project/.vetwo/docs/state.json", '{"a":1}');
    expect(fs.readFile("/project/.vetwo/docs/state.json")).toBe('{"a":1}');
    expect(fs.listFiles("/project/.vetwo/docs").some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("replaces an existing file in place", () => {
    fs.writeFile("/project/.vetwo/docs/state.json", "old");
    atomicWriteFile(fs, "/project/.vetwo/docs/state.json", "new");
    expect(fs.readFile("/project/.vetwo/docs/state.json")).toBe("new");
  });

  it("creates parent directories as needed", () => {
    atomicWriteJson(fs, "/project/.vetwo/docs/compiler/manifest.json", { entries: {} });
    expect(fs.isFile("/project/.vetwo/docs/compiler/manifest.json")).toBe(true);
  });

  it("atomicWriteJson pretty-prints with a trailing newline", () => {
    atomicWriteJson(fs, "/project/a.json", { ok: true });
    expect(fs.readFile("/project/a.json")).toBe('{\n  "ok": true\n}\n');
  });
});
