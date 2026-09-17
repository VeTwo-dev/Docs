import { describe, it, expect, vi } from "vitest";
import {
  createReferenceResolverRegistry,
  resolverSummary,
  type ReferenceResolver,
  type ReferenceBindingInput,
  type ReferenceBindingOutput,
} from "./index.js";

function resolver(
  id: string,
  languageId: string,
  priority: number,
  hooks?: ReferenceResolver["hooks"],
): ReferenceResolver {
  return {
    metadata: {
      id,
      languageId,
      displayName: id,
      version: "1.0.0",
      priority,
      source: "external",
    },
    capabilities: {},
    extractBindings: (input: ReferenceBindingInput): ReferenceBindingOutput => ({
      languageId: input.languageId,
      resolverId: id,
      bindings: {},
      diagnostics: [],
      statistics: {
        files: input.units.length,
        extractedFiles: 0,
        bindingsCount: 0,
        diagnosticsCount: 0,
        extractTimeMs: 0,
      },
    }),
    ...(hooks !== undefined ? { hooks } : {}),
  };
}

describe("ReferenceResolverRegistry", () => {
  it("registers resolvers and resolves the highest priority per language", () => {
    const registry = createReferenceResolverRegistry();
    registry.register(resolver("low", "typescript", 1));
    registry.register(resolver("high", "typescript", 10));
    expect(registry.resolve("typescript")?.metadata.id).toBe("high");
    expect(registry.resolve("javascript")).toBeUndefined();
    expect(registry.list()).toHaveLength(2);
  });

  it("rejects duplicate ids and excessive per-language registrations", () => {
    const registry = createReferenceResolverRegistry();
    registry.register(resolver("a", "typescript", 1));
    expect(() => registry.register(resolver("a", "typescript", 2))).toThrow(/already registered/);
    for (let i = 0; i < 8; i += 1) registry.register(resolver(`x${i}`, "javascript", i));
    expect(() => registry.register(resolver("last", "javascript", 99))).toThrow(/Too many/);
  });

  it("unregisters resolvers and rebuilds the language index", () => {
    const registry = createReferenceResolverRegistry();
    registry.register(resolver("a", "typescript", 1));
    registry.register(resolver("b", "typescript", 2));
    expect(registry.unregister("a")).toBe(true);
    expect(registry.unregister("missing")).toBe(false);
    expect(registry.resolve("typescript")?.metadata.id).toBe("b");
    expect(registry.get("a")).toBeUndefined();
  });

  it("reports capabilities of the winning resolver", () => {
    const registry = createReferenceResolverRegistry();
    registry.register({
      ...resolver("a", "typescript", 1),
      capabilities: { "import-bindings": "full" },
    });
    expect(registry.capabilitiesOf("typescript")?.["import-bindings"]).toBe("full");
    expect(registry.capabilitiesOf("ruby")).toBeUndefined();
  });

  it("invokes lifecycle hooks with a restricted handle", () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();
    const onDispose = vi.fn();
    const registry = createReferenceResolverRegistry();
    registry.register(resolver("a", "typescript", 1, { onRegister, onUnregister, onDispose }));
    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        register: expect.any(Function),
        unregister: expect.any(Function),
        get: expect.any(Function),
      }),
    );
    registry.unregister("a");
    expect(onUnregister).toHaveBeenCalled();
  });

  it("summarizes the winning resolver per language", () => {
    const registry = createReferenceResolverRegistry();
    registry.register(resolver("a", "typescript", 1));
    registry.register(resolver("b", "typescript", 2));
    registry.register(resolver("c", "javascript", 1));
    const summary = resolverSummary(registry);
    expect(summary.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });
});
