import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import { createDocsStateManager, type DocsStateManager } from "./manager.js";
import { getDocsStateRoot } from "./paths.js";

const ROOT = "/project";
const STATE_ROOT = "/project/.vetwo/docs";

describe("state/manager", () => {
  let fs: MemorySafeFileSystem;
  let manager: DocsStateManager;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
    manager = createDocsStateManager({ rootDir: ROOT, fs, engineVersion: "1.2.3", project: "app" });
  });

  it("exposes the state root and resolves raw paths inside it", () => {
    expect(manager.rootDir).toBe(ROOT);
    expect(manager.stateRoot).toBe(STATE_ROOT);
    expect(manager.getRoot()).toBe(STATE_ROOT);
    expect(manager.resolve("manifests", "workspace.json")).toBe(
      `${STATE_ROOT}/manifests/workspace.json`,
    );
    expect(manager.resolve()).toBe(STATE_ROOT);
  });

  it("resolveNamespace maps ids to their flat canonical directories", () => {
    expect(manager.resolveNamespace("scanner", "scanner-cache.json")).toBe(
      `${STATE_ROOT}/scanner/scanner-cache.json`,
    );
    expect(manager.resolveNamespace("manifests", "workspace.json")).toBe(
      `${STATE_ROOT}/manifests/workspace.json`,
    );
    expect(manager.resolveNamespace("temporary")).toBe(`${STATE_ROOT}/temporary`);
    expect(manager.resolveNamespace("plugin:acme")).toBe(`${STATE_ROOT}/plugins/acme`);
    expect(manager.resolveNamespace("ai:openwiki")).toBe(`${STATE_ROOT}/ai/providers/openwiki`);
  });

  it("ensureNamespace creates the namespace directory lazily and records it", () => {
    expect(fs.isDirectory(`${STATE_ROOT}/scanner`)).toBe(false);
    const path = manager.ensureNamespace("scanner");
    expect(path).toBe(`${STATE_ROOT}/scanner`);
    expect(fs.isDirectory(`${STATE_ROOT}/scanner`)).toBe(true);
    expect(manager.getState().namespaces["scanner"]?.active).toBe(true);
  });

  it("ensureNamespace auto-registers unknown ids with safe defaults", () => {
    const path = manager.ensureNamespace("plugin:acme");
    expect(path).toBe(`${STATE_ROOT}/plugins/acme`);
    expect(fs.isDirectory(`${STATE_ROOT}/plugins/acme`)).toBe(true);
  });

  it("writes and reads files and JSON inside the state root", () => {
    const written = manager.write("hello", "temporary", "probe.txt");
    expect(written).toBe(`${STATE_ROOT}/temporary/probe.txt`);
    expect(manager.read("temporary", "probe.txt")).toBe("hello");

    manager.writeJson({ ok: true }, "index", "scan.json");
    expect(manager.readJson<{ ok: boolean }>("index", "scan.json")).toEqual({ ok: true });

    expect(manager.read("index", "missing.json")).toBeUndefined();
    expect(manager.readJson("index", "missing.json")).toBeUndefined();
  });

  it("records written namespaces in state.json", () => {
    manager.writeJson({ a: 1 }, "scanner", "scan.json");
    manager.writeJson({ b: 2 }, "manifests", "workspace.json");

    const state = manager.getState();
    expect(state.namespaces["scanner"]?.active).toBe(true);
    expect(state.namespaces["manifests"]?.active).toBe(true);
    expect(state.engineVersion).toBe("1.2.3");
    expect(state.project).toBe("app");
    expect(state.root).toBe(ROOT);
  });

  it("initialize is idempotent and preserves existing state", () => {
    const first = manager.initialize();
    expect(first.schemaVersion).toBe(1);
    expect(fs.isFile(`${STATE_ROOT}/state.json`)).toBe(true);

    manager.touch("temporary");
    const second = manager.initialize();
    expect(second).toEqual(manager.getState());
    expect(second.namespaces["temporary"]).toBeDefined();
  });

  it("touch records metadata and refreshes lastUsedAt", () => {
    manager.touch("temporary");
    manager.touch("manifests");
    manager.touch("ai");
    const state = manager.getState();
    expect(Object.keys(state.namespaces).sort()).toEqual(["ai", "manifests", "temporary"]);
    expect(state.namespaces["temporary"]?.retention).toBe("temporary");
    expect(state.namespaces["manifests"]?.category).toBeUndefined();
  });

  it("remove deletes a file and reports the change", () => {
    manager.write("x", "temporary", "a.txt");
    expect(manager.remove("temporary", "a.txt")).toBe(true);
    expect(manager.remove("temporary", "a.txt")).toBe(false);
  });

  it("clear removes a whole namespace subtree", () => {
    manager.write("1", "scanner", "a.json");
    manager.write("2", "scanner", "b.json");
    const removed = manager.clear("scanner");
    expect(removed).toContain(`${STATE_ROOT}/scanner`);
    expect(manager.exists("scanner")).toBe(false);
  });

  it("keeps all state inside the canonical root (no root pollution)", () => {
    manager.writeJson({}, "scanner", "x.json");
    manager.writeJson({}, "index", "y.json");
    manager.writeJson({}, "reports", "r.json");
    manager.writeJson({}, "temporary", "t.json");
    manager.writeJson({}, "manifests", "m.json");
    manager.touch("ai");

    const snapshot = fs.snapshot();
    const stateKeys = [...snapshot.keys()];
    expect(stateKeys.length).toBeGreaterThan(0);
    for (const key of stateKeys) {
      expect(key.startsWith(`${STATE_ROOT}/`)).toBe(true);
    }
    expect(stateKeys.some((k) => k.startsWith(`${ROOT}/docs/`))).toBe(false);
    expect(stateKeys.some((k) => k.includes(".docs-cache"))).toBe(false);
  });

  it("getState returns a fresh default when state.json is absent", () => {
    const state = manager.getState();
    expect(state.schemaVersion).toBe(1);
    expect(state.namespaces).toEqual({});
  });

  it("initialize backs up an invalid state.json instead of overwriting it", () => {
    manager.ensureNamespace("scanner");
    fs.writeFile(`${STATE_ROOT}/state.json`, "{ not valid json");
    manager.initialize();
    const files = fs.listFiles(STATE_ROOT);
    expect(files.some((f) => f.startsWith("state.json.corrupt-"))).toBe(true);
    expect(manager.getState().schemaVersion).toBe(1);
  });

  it("respects a custom fs seam", () => {
    const custom = createDocsStateManager({ rootDir: ROOT, fs });
    expect(custom.fs).toBe(fs);
    expect(custom.resolve()).toBe(getDocsStateRoot(ROOT));
  });
});
