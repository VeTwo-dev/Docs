import { describe, expect, it } from "vitest";
import { javascriptAdapter } from "./javascript/adapter.js";
import { typescriptAdapter } from "./typescript/adapter.js";
import { builtinAdapters } from "./index.js";
import {
  JAVASCRIPT_CONFIG_FILES,
  JAVASCRIPT_ENTRY_FILES,
  JAVASCRIPT_FRAMEWORKS,
  JSDOC_COMMENT_STANDARD,
  NODE_ECOSYSTEM_LOCKFILES,
  NODE_FRAMEWORKS,
  TSDOC_COMMENT_STANDARD,
  TYPESCRIPT_CONFIG_FILES,
  TYPESCRIPT_ENTRY_FILES,
  TYPESCRIPT_FRAMEWORKS,
} from "./shared/index.js";

describe("typescriptAdapter", () => {
  it("declares metadata and capabilities", () => {
    expect(typescriptAdapter.metadata.id).toBe("typescript");
    expect(typescriptAdapter.metadata.extensions).toContain(".ts");
    expect(typescriptAdapter.capabilities.typeSystem).toBe("full");
    expect(typescriptAdapter.capabilities.ast).toBe(false);
  });

  it("declares config files, entry files and frameworks", () => {
    expect(typescriptAdapter.metadata.configFiles).toContain("tsconfig.json");
    expect(typescriptAdapter.metadata.defaultEntryFiles).toEqual(TYPESCRIPT_ENTRY_FILES);
    expect(typescriptAdapter.frameworkSupport?.map((f) => f.id)).toContain("nextjs");
  });
});

describe("javascriptAdapter", () => {
  it("declares metadata and capabilities", () => {
    expect(javascriptAdapter.metadata.id).toBe("javascript");
    expect(javascriptAdapter.metadata.extensions).toContain(".js");
    expect(javascriptAdapter.capabilities.typeSystem).toBe(false);
    expect(javascriptAdapter.capabilities.packages).toBe("full");
  });

  it("declares config files and frameworks", () => {
    expect(javascriptAdapter.metadata.configFiles).toEqual(JAVASCRIPT_CONFIG_FILES);
    expect(javascriptAdapter.frameworkSupport?.map((f) => f.id)).toContain("react");
  });
});

describe("builtinAdapters", () => {
  it("contains exactly the two built-ins", () => {
    expect(builtinAdapters.map((a) => a.metadata.id)).toEqual(["typescript", "javascript"]);
  });

  it("produces valid, non-conflicting registrations", () => {
    const ids = new Set<string>();
    for (const adapter of builtinAdapters) {
      expect(ids.has(adapter.metadata.id)).toBe(false);
      ids.add(adapter.metadata.id);
    }
  });
});

describe("shared constants", () => {
  it("defines lockfiles, configs and entries", () => {
    expect(NODE_ECOSYSTEM_LOCKFILES).toContain("package-lock.json");
    expect(TYPESCRIPT_CONFIG_FILES).toContain("tsconfig.json");
    expect(JAVASCRIPT_ENTRY_FILES).toContain("index.js");
  });

  it("defines comment standards and frameworks", () => {
    expect(JSDOC_COMMENT_STANDARD.id).toBe("jsdoc");
    expect(TSDOC_COMMENT_STANDARD.id).toBe("tsdoc");
    expect(TYPESCRIPT_FRAMEWORKS.map((f) => f.id)).toContain("angular");
    expect(JAVASCRIPT_FRAMEWORKS.map((f) => f.id)).toContain("fastify");
    expect(NODE_FRAMEWORKS).toHaveLength(
      TYPESCRIPT_FRAMEWORKS.length + JAVASCRIPT_FRAMEWORKS.length,
    );
  });
});
