import { describe, expect, it } from "vitest";
import type { LanguageAdapter } from "../contracts/adapter.js";
import { createLanguageRegistry } from "./registry.js";

const tsAdapter: LanguageAdapter = {
  metadata: {
    id: "typescript",
    displayName: "TypeScript",
    priority: 10,
    extensions: [".ts"],
    fileNames: ["tsconfig.json"],
    mimeTypes: ["application/typescript"],
    configFiles: ["tsconfig.json"],
  },
  capabilities: { scanning: true },
  frameworkSupport: [{ id: "nextjs", name: "Next.js", dependencies: ["next"] }],
};

const jsAdapter: LanguageAdapter = {
  metadata: {
    id: "javascript",
    displayName: "JavaScript",
    priority: 5,
    extensions: [".js"],
    fileNames: ["jsconfig.json"],
  },
  capabilities: {},
};

describe("LanguageRegistry", () => {
  it("registers and looks up adapters", () => {
    const registry = createLanguageRegistry();
    const result = registry.register(tsAdapter);
    expect(result.status).toBe("registered");
    expect(result.diagnostics).toEqual([]);
    expect(registry.size()).toBe(1);
    expect(registry.has("typescript")).toBe(true);
    expect(registry.has("TYPESCRIPT")).toBe(true);
    expect(registry.get("typescript")?.id).toBe("typescript");
    expect(registry.get("typescript")?.priority).toBe(10);
  });

  it("sorts all() by priority then id", () => {
    const registry = createLanguageRegistry();
    registry.register(jsAdapter);
    registry.register(tsAdapter);
    expect(registry.all().map((m) => m.id)).toEqual(["typescript", "javascript"]);
  });

  it("rejects invalid adapters", () => {
    const registry = createLanguageRegistry();
    const result = registry.register({
      metadata: { id: "", displayName: "" },
      capabilities: {},
    } as unknown as LanguageAdapter);
    expect(result.status).toBe("invalid");
    expect(registry.size()).toBe(0);
  });

  it("replaces duplicate registrations with a warning", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    const result = registry.register({ ...tsAdapter, capabilities: { scanning: false } });
    expect(result.status).toBe("replaced");
    expect(result.diagnostics[0]?.code).toBe("duplicate-registration");
    expect(registry.get("typescript")?.capabilities.scanning).toBe(false);
  });

  it("flags conflicting adapters sharing an extension with >= priority", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    const rival = {
      metadata: { id: "stencil", displayName: "Stencil", priority: 10, extensions: [".ts"] },
      capabilities: {},
    } as LanguageAdapter;
    const result = registry.register(rival);
    expect(result.status).toBe("conflict");
    expect(result.diagnostics.some((d) => d.code === "conflicting-adapters")).toBe(true);
    expect(result.diagnostics[0]?.related).toEqual(["typescript"]);
  });

  it("flags any shared extension as a conflict, priority decides resolution", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    const rival = {
      metadata: { id: "older", displayName: "Older", priority: 1, extensions: [".ts"] },
      capabilities: {},
    } as LanguageAdapter;
    const result = registry.register(rival);
    expect(result.status).toBe("conflict");
    expect(registry.byExtension(".ts").map((m) => m.id)).toEqual(["typescript", "older"]);
  });

  it("unregisters adapters and rebuilds indexes", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    registry.register(jsAdapter);
    expect(registry.unregister("typescript")).toBe(true);
    expect(registry.size()).toBe(1);
    expect(registry.byExtension(".ts")).toEqual([]);
    expect(registry.byExtension(".js")).toHaveLength(1);
    expect(registry.unregister("missing")).toBe(false);
  });

  it("clears all adapters and indexes", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    registry.register(jsAdapter);
    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.all()).toEqual([]);
  });

  it("looks up by extension, mime type, file name and framework", () => {
    const registry = createLanguageRegistry();
    registry.register(tsAdapter);
    registry.register(jsAdapter);
    expect(registry.byExtension(".ts").map((m) => m.id)).toEqual(["typescript"]);
    expect(registry.byExtension("TS").map((m) => m.id)).toEqual(["typescript"]);
    expect(registry.byMimeType("application/typescript").map((m) => m.id)).toEqual(["typescript"]);
    expect(registry.byFileName("tsconfig.json").map((m) => m.id)).toEqual(["typescript"]);
    expect(registry.byFramework("nextjs").map((m) => m.id)).toEqual(["typescript"]);
    expect(registry.byExtension(".xyz")).toEqual([]);
    expect(registry.byMimeType("missing/mime")).toEqual([]);
    expect(registry.byFileName("missing.json")).toEqual([]);
    expect(registry.byFramework("unknown")).toEqual([]);
  });

  it("indexes entry files for byFileName lookups", () => {
    const registry = createLanguageRegistry();
    registry.register({
      metadata: { id: "x", displayName: "X", defaultEntryFiles: ["main.ts"] },
      capabilities: {},
    });
    expect(registry.byFileName("main.ts").map((m) => m.id)).toEqual(["x"]);
  });

  it("getOrThrow throws for unknown languages", () => {
    const registry = createLanguageRegistry();
    expect(() => registry.getOrThrow("python")).toThrow(/No language adapter/);
    registry.register(tsAdapter);
    expect(registry.getOrThrow("typescript").id).toBe("typescript");
  });

  it("returns priority-sorted results for shared indexes", () => {
    const registry = createLanguageRegistry();
    const low = {
      metadata: { id: "low", displayName: "Low", priority: 1, extensions: [".ts"] },
      capabilities: {},
    } as LanguageAdapter;
    registry.register(tsAdapter);
    registry.register(low);
    expect(registry.byExtension(".ts").map((m) => m.id)).toEqual(["typescript", "low"]);
  });
});
