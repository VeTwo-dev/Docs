import { describe, it, expect } from "vitest";
import { createCompilerAdapter, type CompilerAdapter } from "../contracts/adapter.js";
import { createCompilerRegistry } from "./registry.js";

function adapter(
  overrides: Partial<CompilerAdapter> = {},
  metadataOverrides: Partial<CompilerAdapter["metadata"]> = {},
): CompilerAdapter {
  return createCompilerAdapter({
    metadata: {
      id: "test",
      displayName: "Test Compiler",
      languageId: "test",
      version: "1.0.0",
      priority: 1,
      extensions: [".tst"],
      syntax: ["test"],
      ...metadataOverrides,
    },
    capabilities: {
      parsing: "full",
      diagnostics: "full",
      sourceMaps: "none",
    },
    compile: async () => ({ units: [], dependencies: {}, failedFiles: [], diagnostics: [] }),
    ...overrides,
  });
}

describe("CompilerRegistry", () => {
  it("starts empty and registers compilers", () => {
    const registry = createCompilerRegistry();
    expect(registry.size()).toBe(0);
    const result = registry.register(adapter());
    expect(result.status).toBe("registered");
    expect(result.compilerId).toBe("test");
    expect(registry.size()).toBe(1);
    expect(registry.has("test")).toBe(true);
    expect(registry.has("TEST")).toBe(true);
  });

  it("returns all compilers priority-sorted then id-sorted", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "low", priority: 1 }));
    registry.register(adapter({}, { id: "high", priority: 9 }));
    registry.register(adapter({}, { id: "mid", priority: 5 }));
    expect(registry.all().map((a) => a.metadata.id)).toEqual(["high", "mid", "low"]);
  });

  it("replaces a compiler registered under the same id", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "dup", version: "1.0.0" }));
    const result = registry.register(adapter({}, { id: "dup", version: "2.0.0" }));
    expect(result.status).toBe("replaced");
    expect(registry.get("dup")?.metadata.version).toBe("2.0.0");
    expect(result.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("rejects invalid metadata with an error status", () => {
    const registry = createCompilerRegistry();
    const result = registry.register(adapter({}, { id: "bad id!" }));
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(registry.size()).toBe(0);
  });

  it("rejects invalid capability values", () => {
    const registry = createCompilerRegistry();
    const bad = adapter();
    const result = registry.register(
      createCompilerAdapter({
        ...bad,
        capabilities: { ...bad.capabilities, sourceMaps: "ultra" as never },
      }),
    );
    expect(result.status).toBe("invalid");
  });

  it("flags conflicts when two compilers share language and extension", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "a", languageId: "x", extensions: [".x"] }));
    const result = registry.register(adapter({}, { id: "b", languageId: "x", extensions: [".x"] }));
    expect(result.status).toBe("conflict");
    expect(result.diagnostics.some((d) => d.related?.includes("a"))).toBe(true);
  });

  it("does not flag a conflict when only the language matches", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "a", languageId: "x", extensions: [".a"] }));
    const result = registry.register(adapter({}, { id: "b", languageId: "x", extensions: [".b"] }));
    expect(result.status).toBe("registered");
  });

  it("resolves by language, capability and version filters", () => {
    const registry = createCompilerRegistry();
    registry.register(
      adapter(
        { capabilities: { parsing: "full", diagnostics: "full", sourceMaps: "full" } },
        { id: "full", languageId: "lang", version: "2.0.0", priority: 5 },
      ),
    );
    registry.register(
      adapter({}, { id: "basic", languageId: "lang", version: "1.0.0", priority: 1 }),
    );

    expect(registry.resolve("lang")?.metadata.id).toBe("full");
    expect(registry.resolve("lang", { capability: "sourceMaps" })?.metadata.id).toBe("full");
    expect(registry.resolve("lang", { version: "<2.0.0" })?.metadata.id).toBe("basic");
    expect(registry.resolve("missing")).toBe(undefined);
  });

  it("indexes languages, extensions and capabilities", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "x", languageId: "lang", extensions: [".foo"] }));
    expect(registry.byLanguage("lang")).toHaveLength(1);
    expect(registry.byExtension(".foo")).toHaveLength(1);
    expect(registry.byCapability("diagnostics")).toHaveLength(1);
    expect(registry.byLanguage("nope")).toEqual([]);
    expect(registry.byExtension(".nope")).toEqual([]);
  });

  it("reports capability level and presence", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter());
    expect(registry.capabilityLevelOf("test", "parsing")).toBe(2);
    expect(registry.capabilityLevelOf("test", "sourceMaps")).toBe(0);
    expect(registry.capabilityLevelOf("missing", "parsing")).toBe(0);
    expect(registry.hasCapability("test", "diagnostics")).toBe(true);
    expect(registry.hasCapability("test", "watch")).toBe(false);
    expect(registry.hasCapability("missing", "parsing")).toBe(false);
  });

  it("unregisters by id and clears", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "a" }));
    registry.register(adapter({}, { id: "b" }));
    expect(registry.unregister("a")).toBe(true);
    expect(registry.has("a")).toBe(false);
    expect(registry.unregister("a")).toBe(false);
    expect(registry.size()).toBe(1);
    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.all()).toEqual([]);
  });

  it("getOrThrow throws for unknown ids", () => {
    const registry = createCompilerRegistry();
    expect(() => registry.getOrThrow("missing")).toThrow();
  });

  it("re-indexes after unregister", () => {
    const registry = createCompilerRegistry();
    registry.register(adapter({}, { id: "a", languageId: "lang", extensions: [".foo"] }));
    registry.register(adapter({}, { id: "b", languageId: "lang", extensions: [".bar"] }));
    registry.unregister("a");
    expect(registry.byExtension(".foo")).toEqual([]);
    expect(registry.byLanguage("lang").map((a) => a.metadata.id)).toEqual(["b"]);
  });
});
