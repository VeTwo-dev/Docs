import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import { runStateDoctor, stateSize } from "./doctor.js";
import { createDocsStateManager, type DocsStateManager } from "./manager.js";
import { STATE_SCHEMA_VERSION, writeStateManifest, createStateManifest } from "./manifest.js";

const ROOT = "/project";

describe("state/doctor", () => {
  let fs: MemorySafeFileSystem;
  let manager: DocsStateManager;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
    manager = createDocsStateManager({ rootDir: ROOT, fs, project: "app" });
  });

  it("reports a clean, healthy state root", () => {
    manager.initialize();
    manager.writeJson({}, "scanner", "scan.json");
    manager.writeJson({ schemaVersion: 1 }, "manifests", "workspace.json");

    const report = runStateDoctor(fs, ROOT);
    expect(report.stateRoot).toBe("/project/.vetwo/docs");
    expect(report.checks.every((c) => c.pass)).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.checks.length);
  });

  it("flags a missing state root", () => {
    const report = runStateDoctor(fs, ROOT);
    const check = report.checks.find((c) => c.id === "state-root");
    expect(check?.pass).toBe(false);
    expect(check?.detail).toContain("docs init");
  });

  it("flags a missing or corrupted state.json", () => {
    manager.initialize();
    fs.writeFile("/project/.vetwo/docs/state.json", "not json{{");
    const report = runStateDoctor(fs, ROOT);
    expect(report.checks.find((c) => c.id === "state-manifest")?.pass).toBe(false);
  });

  it("flags an unsupported newer schema version", () => {
    manager.initialize();
    writeStateManifest(fs, ROOT, {
      ...createStateManifest({ root: ROOT }),
      schemaVersion: STATE_SCHEMA_VERSION + 1,
    });
    const report = runStateDoctor(fs, ROOT);
    expect(report.checks.find((c) => c.id === "schema-version")?.pass).toBe(false);
  });

  it("flags pending legacy-state migration", () => {
    fs.writeFile(`${ROOT}/.docs-cache/manifest.json`, "{}");
    const report = runStateDoctor(fs, ROOT);
    expect(report.checks.find((c) => c.id === "migration")?.pass).toBe(false);
  });

  it("flags unknown directories under the state root", () => {
    manager.initialize();
    fs.writeFile("/project/.vetwo/docs/bogus/file.json", "{}");
    const report = runStateDoctor(fs, ROOT);
    const check = report.checks.find((c) => c.id === "unknown-state");
    expect(check?.pass).toBe(false);
    expect(check?.detail).toContain("bogus");
  });

  it("flags orphaned namespaces recorded in the manifest", () => {
    manager.initialize();
    writeStateManifest(fs, ROOT, {
      ...createStateManifest({ root: ROOT }),
      namespaces: { "plugin:uninstalled": { version: 1, active: true } },
    });
    const report = runStateDoctor(fs, ROOT);
    const check = report.checks.find((c) => c.id === "orphaned-namespaces");
    expect(check?.pass).toBe(false);
    expect(check?.detail).toContain("plugin:uninstalled");
  });

  it("flags namespaces that exist on disk but are untracked", () => {
    manager.initialize();
    manager.writeJson({}, "index", "scan.json");
    fs.writeFile("/project/.vetwo/docs/reports/r.md", "x");
    const report = runStateDoctor(fs, ROOT);
    const check = report.checks.find((c) => c.id === "consistent-manifest");
    expect(check?.pass).toBe(false);
    expect(check?.detail).toContain("reports");
  });

  it("flags a corrupted workspace manifest", () => {
    manager.initialize();
    fs.writeFile("/project/.vetwo/docs/manifests/workspace.json", "{nope");
    const report = runStateDoctor(fs, ROOT);
    expect(report.checks.find((c) => c.id === "workspace-manifest")?.pass).toBe(false);
  });

  it("reports disk usage for the state root", () => {
    manager.initialize();
    fs.writeFile("/project/.vetwo/docs/temporary/a.txt", "x".repeat(2048));
    const report = runStateDoctor(fs, ROOT);
    const check = report.checks.find((c) => c.id === "disk-usage");
    expect(check?.pass).toBe(true);
    expect(check?.detail).toContain("KiB");
  });

  it("computes state size across files", () => {
    fs.writeFile("/project/.vetwo/docs/temporary/a.txt", "aaa");
    fs.writeFile("/project/.vetwo/docs/temporary/b.txt", "bb");
    expect(stateSize(fs, "/project/.vetwo/docs")).toBe(5);
  });
});
