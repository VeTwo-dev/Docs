import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../init/filesystem/memory.js";
import {
  detectLegacyState,
  planMigration,
  applyMigration,
  needsMigration,
  detectV1Layout,
  MIGRATION_VERSION,
  MigrationError,
} from "./migrate.js";
import { createDocsStateManager, type DocsStateManager } from "./manager.js";

const ROOT = "/project";

function writeLegacyCache(fs: MemorySafeFileSystem): void {
  fs.writeFile(`${ROOT}/.docs-cache/manifest.json`, JSON.stringify({ entries: {} }));
  fs.writeFile(`${ROOT}/.docs-cache/generator-manifest.json`, JSON.stringify({ version: "1.0.0" }));
  fs.writeFile(
    `${ROOT}/.docs-cache/scanner-cache.json`,
    JSON.stringify({ version: 1, entries: {} }),
  );
  fs.writeFile(`${ROOT}/.docs-cache/2cf24dba5fb0a30e.json`, '{"value":1}');
  fs.writeFile(`${ROOT}/.docs-cache/notes.txt`, "not ours");
}

/** v1 layout as produced before the flat namespace model. */
function writeV1Layout(fs: MemorySafeFileSystem): void {
  fs.writeFile(`${ROOT}/.vetwo/docs/cache/scanner/scanner-cache.json`, '{"v":1}');
  fs.writeFile(`${ROOT}/.vetwo/docs/cache/general/manifest.json`, '{"entries":{}}');
}

describe("state/migrate", () => {
  let fs: MemorySafeFileSystem;
  let manager: DocsStateManager;

  beforeEach(() => {
    fs = new MemorySafeFileSystem();
    manager = createDocsStateManager({ rootDir: ROOT, fs, project: "app" });
  });

  it("detects owned and unowned legacy locations", () => {
    fs.writeFile(`${ROOT}/.docs-cache/manifest.json`, "{}");
    fs.writeFile(`${ROOT}/docs/.cache/random.json`, "{}");

    const legacy = detectLegacyState(fs, ROOT);
    const owned = legacy.find((l) => l.relativePath === ".docs-cache");
    const unowned = legacy.find((l) => l.relativePath === "docs/.cache");

    expect(owned?.owned).toBe(true);
    expect(owned?.files).toEqual(["manifest.json"]);
    expect(unowned?.owned).toBe(false);
  });

  it("plans known cache files into their namespaces and skips the rest", () => {
    writeLegacyCache(fs);
    const plan = planMigration(fs, ROOT);

    expect(plan.migrationVersion).toBe(MIGRATION_VERSION);
    expect(plan.steps).toHaveLength(4);
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        {
          from: `${ROOT}/.docs-cache/manifest.json`,
          to: `${ROOT}/.vetwo/docs/compiler/manifest.json`,
        },
        {
          from: `${ROOT}/.docs-cache/generator-manifest.json`,
          to: `${ROOT}/.vetwo/docs/generator/generator-manifest.json`,
        },
        {
          from: `${ROOT}/.docs-cache/scanner-cache.json`,
          to: `${ROOT}/.vetwo/docs/scanner/scanner-cache.json`,
        },
        {
          from: `${ROOT}/.docs-cache/2cf24dba5fb0a30e.json`,
          to: `${ROOT}/.vetwo/docs/compiler/2cf24dba5fb0a30e.json`,
        },
      ]),
    );
    expect(plan.skipped).toEqual([`${ROOT}/.docs-cache/notes.txt`]);
  });

  it("detects the v1 cache layout for relocation", () => {
    writeV1Layout(fs);
    expect(detectV1Layout(fs, ROOT)).toEqual([
      {
        from: `${ROOT}/.vetwo/docs/cache/general/manifest.json`,
        to: `${ROOT}/.vetwo/docs/compiler/manifest.json`,
      },
      {
        from: `${ROOT}/.vetwo/docs/cache/scanner/scanner-cache.json`,
        to: `${ROOT}/.vetwo/docs/scanner/scanner-cache.json`,
      },
    ]);
    expect(needsMigration(fs, ROOT)).toBe(true);
  });

  it("applies a migration, verifies, and removes legacy state", () => {
    writeLegacyCache(fs);
    expect(needsMigration(fs, ROOT)).toBe(true);

    const result = applyMigration(fs, ROOT);

    expect(result.applied).toBe(true);
    expect(result.moved).toHaveLength(4);
    expect(result.removedLegacy).toEqual([`${ROOT}/.docs-cache`]);
    expect(result.skipped).toEqual([`${ROOT}/.docs-cache/notes.txt`]);

    expect(fs.isFile(`${ROOT}/.vetwo/docs/compiler/manifest.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/generator/generator-manifest.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/scanner/scanner-cache.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/compiler/2cf24dba5fb0a30e.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(false);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/.migrating`)).toBe(false);
    expect(needsMigration(fs, ROOT)).toBe(false);
  });

  it("relocates v1 layout files into the flat namespace layout", () => {
    writeV1Layout(fs);
    const result = applyMigration(fs, ROOT);
    expect(result.applied).toBe(true);
    expect(result.relocated).toHaveLength(2);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/compiler/manifest.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/scanner/scanner-cache.json`)).toBe(true);
    expect(fs.isDirectory(`${ROOT}/.vetwo/docs/cache`)).toBe(false);
    expect(needsMigration(fs, ROOT)).toBe(false);
  });

  it("preserves file contents after migration", () => {
    writeLegacyCache(fs);
    applyMigration(fs, ROOT);
    expect(fs.readFile(`${ROOT}/.vetwo/docs/scanner/scanner-cache.json`)).toBe(
      JSON.stringify({ version: 1, entries: {} }),
    );
    expect(fs.readFile(`${ROOT}/.vetwo/docs/compiler/2cf24dba5fb0a30e.json`)).toBe('{"value":1}');
  });

  it("is idempotent when there is nothing to migrate", () => {
    writeLegacyCache(fs);
    applyMigration(fs, ROOT);

    const second = applyMigration(fs, ROOT);
    expect(second.applied).toBe(false);
    expect(second.moved).toEqual([]);
  });

  it("bumps the state manifest migration version via the manager", () => {
    writeLegacyCache(fs);
    manager.initialize();
    const result = manager.migrate();
    expect(result.applied).toBe(true);
    expect(manager.getState().migrationVersion).toBe(MIGRATION_VERSION);
  });

  it("recovers from an interrupted migration without losing source state", () => {
    writeLegacyCache(fs);
    fs.failOn(`${ROOT}/.vetwo/docs/scanner/`);

    expect(() => applyMigration(fs, ROOT)).toThrow();
    expect(fs.isFile(`${ROOT}/.vetwo/docs/.migrating`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(true);

    fs.clearFailures();
    const resumed = applyMigration(fs, ROOT);
    expect(resumed.applied).toBe(true);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(false);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/.migrating`)).toBe(false);
    expect(fs.readFile(`${ROOT}/.vetwo/docs/scanner/scanner-cache.json`)).toBe(
      JSON.stringify({ version: 1, entries: {} }),
    );
  });

  it("wraps I/O failures in a MigrationError leaving source intact", () => {
    writeLegacyCache(fs);
    fs.failOn(`${ROOT}/.vetwo/docs/compiler/`);

    let error: unknown;
    try {
      applyMigration(fs, ROOT);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(MigrationError);
    expect(fs.isFile(`${ROOT}/.docs-cache/manifest.json`)).toBe(true);
    expect(fs.isFile(`${ROOT}/.vetwo/docs/.migrating`)).toBe(true);
  });

  it("reports unowned legacy locations without migrating them", () => {
    fs.writeFile(`${ROOT}/docs/.cache/user-file.json`, "{}");
    const plan = planMigration(fs, ROOT);
    expect(plan.steps).toEqual([]);
    expect(plan.skipped).toEqual([`${ROOT}/docs/.cache`]);

    const result = applyMigration(fs, ROOT);
    expect(result.applied).toBe(false);
    expect(fs.isFile(`${ROOT}/docs/.cache/user-file.json`)).toBe(true);
  });

  it("no-ops when no legacy state exists", () => {
    const result = applyMigration(fs, ROOT);
    expect(result.applied).toBe(false);
    expect(needsMigration(fs, ROOT)).toBe(false);
  });
});
