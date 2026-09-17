import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import { cleanState } from "./clean.js";

const ROOT = "/project";
const STATE_ROOT = "/project/.vetwo/docs";

describe("state/clean", () => {
  let fs: MemorySafeFileSystem;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
    fs.writeFile(`${STATE_ROOT}/scanner/scanner-cache.json`, "{}");
    fs.writeFile(`${STATE_ROOT}/compiler/x.json`, "{}");
    fs.writeFile(`${STATE_ROOT}/temporary/tmp.txt`, "x");
    fs.writeFile(`${STATE_ROOT}/reports/report.md`, "x");
    fs.writeFile(`${STATE_ROOT}/diagnostics/diag.json`, "{}");
    fs.writeFile(`${STATE_ROOT}/index/symbols.json`, "{}");
    fs.writeFile(`${ROOT}/.docs-cache/manifest.json`, "{}");
  });

  it("defaults to cleaning caches, temporary files, reports and legacy state", () => {
    const result = cleanState(fs, ROOT);
    expect(result.removed).toContain(`${STATE_ROOT}/scanner`);
    expect(result.removed).toContain(`${STATE_ROOT}/compiler`);
    expect(result.removed).toContain(`${STATE_ROOT}/temporary`);
    expect(result.removed).toContain(`${STATE_ROOT}/reports`);
    expect(result.removed).toContain(`${STATE_ROOT}/diagnostics`);
    expect(result.removed).toContain(`${ROOT}/.docs-cache`);

    expect(fs.isFile(`${STATE_ROOT}/scanner/scanner-cache.json`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/temporary/tmp.txt`)).toBe(false);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/index/symbols.json`)).toBe(true);
  });

  it("cleans only cache namespaces when requested", () => {
    const result = cleanState(fs, ROOT, {
      cache: true,
      temporary: false,
      reports: false,
      legacy: false,
    });
    expect(result.removed).toEqual([`${STATE_ROOT}/compiler`, `${STATE_ROOT}/scanner`]);
    expect(fs.isFile(`${STATE_ROOT}/temporary/tmp.txt`)).toBe(true);
    expect(fs.isFile(`${STATE_ROOT}/index/symbols.json`)).toBe(true);
  });

  it("cleans only temporary files when requested", () => {
    cleanState(fs, ROOT, { cache: false, temporary: true, reports: false, legacy: false });
    expect(fs.isFile(`${STATE_ROOT}/temporary/tmp.txt`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/scanner/scanner-cache.json`)).toBe(true);
  });

  it("cleans reports and diagnostics together", () => {
    cleanState(fs, ROOT, { cache: false, temporary: false, reports: true, legacy: false });
    expect(fs.isFile(`${STATE_ROOT}/reports/report.md`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/diagnostics/diag.json`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/scanner/scanner-cache.json`)).toBe(true);
  });

  it("state flag removes regenerable indexes but never manifests", () => {
    fs.writeFile(`${STATE_ROOT}/manifests/workspace.json`, "{}");
    const result = cleanState(fs, ROOT, {
      cache: false,
      temporary: false,
      reports: false,
      state: true,
    });
    expect(result.removed).toContain(`${STATE_ROOT}/index`);
    expect(result.removed).not.toContain(`${STATE_ROOT}/manifests`);
    expect(fs.isFile(`${STATE_ROOT}/index/symbols.json`)).toBe(false);
    expect(fs.isFile(`${STATE_ROOT}/manifests/workspace.json`)).toBe(true);
    expect(fs.isFile(`${STATE_ROOT}/scanner/scanner-cache.json`)).toBe(true);
  });

  it("supports dry-run without touching anything", () => {
    const result = cleanState(fs, ROOT, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.removed).toContain(`${STATE_ROOT}/scanner`);
    expect(fs.isFile(`${STATE_ROOT}/scanner/scanner-cache.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(true);
  });

  it("never touches user output, config or agent workspace", () => {
    fs.writeFile(`${ROOT}/docs/md/README.md`, "# docs");
    fs.writeFile(`${ROOT}/docs.config.ts`, "export default {}");
    fs.writeFile(`${ROOT}/agent/skill.md`, "# skill");
    cleanState(fs, ROOT, { state: true });
    expect(fs.isFile(`${ROOT}/docs/md/README.md`)).toBe(true);
    expect(fs.isFile(`${ROOT}/docs.config.ts`)).toBe(true);
    expect(fs.isFile(`${ROOT}/agent/skill.md`)).toBe(true);
  });

  it("never targets unknown or unregistered directories", () => {
    fs.writeFile(`${STATE_ROOT}/plugin-unknown/x.json`, "{}");
    fs.writeFile(`${STATE_ROOT}/notes.txt`, "mine");
    cleanState(fs, ROOT);
    expect(fs.isFile(`${STATE_ROOT}/plugin-unknown/x.json`)).toBe(true);
    expect(fs.isFile(`${STATE_ROOT}/notes.txt`)).toBe(true);
    expect(fs.isFile(`${STATE_ROOT}/state.json`)).toBe(false);
  });

  it("reports no removals when nothing exists", () => {
    const empty = new MemorySafeFileSystem();
    const result = cleanState(empty, ROOT);
    expect(result.removed).toEqual([]);
  });
});
