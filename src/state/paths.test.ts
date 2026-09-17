import { describe, it, expect } from "vitest";
import {
  VETWO_DIR,
  DOCS_STATE_DIR,
  STATE_MANIFEST_FILE,
  MIGRATION_MARKER,
  LEGACY_OWNED_CACHE_DIRS,
  LEGACY_UNOWNED_CACHE_DIRS,
  getVetwoRoot,
  getDocsStateRoot,
  resolveDocsStatePath,
  resolveDocsNamespacePath,
} from "./paths.js";
import { DEFAULT_STATE_NAMESPACES, namespaceSegments } from "./registry.js";

const ROOT = "/project";

describe("state/paths", () => {
  it("defines the canonical directory names", () => {
    expect(VETWO_DIR).toBe(".vetwo");
    expect(DOCS_STATE_DIR).toBe("docs");
    expect(STATE_MANIFEST_FILE).toBe("state.json");
    expect(MIGRATION_MARKER).toBe(".migrating");
    expect(LEGACY_OWNED_CACHE_DIRS).toEqual([".docs-cache"]);
    expect(LEGACY_UNOWNED_CACHE_DIRS.length).toBeGreaterThan(0);
  });

  it("getVetwoRoot resolves the .vetwo directory", () => {
    expect(getVetwoRoot(ROOT)).toBe("/project/.vetwo");
  });

  it("getDocsStateRoot resolves the canonical state root", () => {
    expect(getDocsStateRoot(ROOT)).toBe("/project/.vetwo/docs");
  });

  it("resolveDocsStatePath joins under the state root", () => {
    expect(resolveDocsStatePath(ROOT, "manifests", "workspace.json")).toBe(
      "/project/.vetwo/docs/manifests/workspace.json",
    );
    expect(resolveDocsStatePath(ROOT)).toBe("/project/.vetwo/docs");
  });

  it("resolveDocsNamespacePath maps flat namespaces without cache nesting", () => {
    expect(resolveDocsNamespacePath(ROOT, "scanner", "scanner-cache.json")).toBe(
      "/project/.vetwo/docs/scanner/scanner-cache.json",
    );
    expect(resolveDocsNamespacePath(ROOT, "compiler")).toBe("/project/.vetwo/docs/compiler");
  });

  it("resolveDocsNamespacePath maps hierarchical plugin ids", () => {
    expect(resolveDocsNamespacePath(ROOT, "plugin:acme")).toBe("/project/.vetwo/docs/plugins/acme");
    expect(resolveDocsNamespacePath(ROOT, "plugin:acme", "data.json")).toBe(
      "/project/.vetwo/docs/plugins/acme/data.json",
    );
  });

  it("resolveDocsNamespacePath maps hierarchical ai provider ids", () => {
    expect(resolveDocsNamespacePath(ROOT, "ai:openwiki")).toBe(
      "/project/.vetwo/docs/ai/providers/openwiki",
    );
  });

  it("every registered namespace resolves inside the state root", () => {
    for (const def of DEFAULT_STATE_NAMESPACES) {
      expect(resolveDocsNamespacePath(ROOT, def.id)).toMatch(/^\/project\/\.vetwo\/docs\//);
    }
  });

  it("namespaceSegments maps special ids, others stay flat", () => {
    expect(namespaceSegments("scanner")).toEqual(["scanner"]);
    expect(namespaceSegments("plugin:acme")).toEqual(["plugins", "acme"]);
    expect(namespaceSegments("ai:openwiki")).toEqual(["ai", "providers", "openwiki"]);
  });
});
