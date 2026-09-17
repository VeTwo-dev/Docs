import { describe, it, expect, vi } from "vitest";
import { createSymbolExtractorRegistry, resolverSummary } from "./registry.js";
import { createSymbolExtractor, type SymbolExtractor } from "../contracts/extractor.js";

function extractor(
  id: string,
  languageId: string,
  priority = 0,
  hooks?: SymbolExtractor["hooks"],
): SymbolExtractor {
  return createSymbolExtractor({
    metadata: {
      id,
      languageId,
      displayName: id,
      version: "1.0.0",
      priority,
      source: "builtin",
    },
    capabilities: {},
    extract: () => ({
      languageId,
      extractorId: id,
      modules: [],
      symbols: [],
      relationships: [],
      diagnostics: [],
      extractedFiles: [],
      statistics: {
        files: 0,
        extractedFiles: 0,
        cachedFiles: 0,
        symbolCount: 0,
        moduleCount: 0,
        diagnosticsCount: 0,
        extractTimeMs: 0,
      },
    }),
    ...(hooks !== undefined ? { hooks } : {}),
  });
}

describe("createSymbolExtractorRegistry", () => {
  it("registers and resolves extractors", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(extractor("ts", "typescript"));
    expect(registry.resolve("typescript")?.metadata.id).toBe("ts");
    expect(registry.get("ts")?.metadata.id).toBe("ts");
    expect(registry.list()).toHaveLength(1);
  });

  it("resolves the highest-priority extractor for a language", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(extractor("ts-low", "typescript", 0));
    registry.register(extractor("ts-high", "typescript", 10));
    expect(registry.resolve("typescript")?.metadata.id).toBe("ts-high");
    expect(registry.list()).toHaveLength(2);
  });

  it("returns undefined for unknown languages", () => {
    const registry = createSymbolExtractorRegistry();
    expect(registry.resolve("rust")).toBeUndefined();
    expect(registry.capabilitiesOf("rust")).toBeUndefined();
  });

  it("rejects duplicate ids", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(extractor("ts", "typescript"));
    expect(() => registry.register(extractor("ts", "typescript"))).toThrow(/already registered/);
  });

  it("rejects too many extractors for one language", () => {
    const registry = createSymbolExtractorRegistry();
    for (let index = 0; index < 8; index += 1) {
      registry.register(extractor(`ts-${index}`, "typescript", index));
    }
    expect(() => registry.register(extractor("ts-8", "typescript"))).toThrow(/max 8/);
  });

  it("unregisters extractors and rebuilds the language index", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(extractor("ts", "typescript"));
    expect(registry.unregister("ts")).toBe(true);
    expect(registry.resolve("typescript")).toBeUndefined();
    expect(registry.unregister("ts")).toBe(false);
  });

  it("exposes capabilities of the resolved extractor", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(
      createSymbolExtractor({
        metadata: {
          id: "ts",
          languageId: "typescript",
          displayName: "ts",
          version: "1",
          priority: 0,
          source: "builtin",
        },
        capabilities: { documents: "tsdoc" },
        extract: () => {
          throw new Error("not used");
        },
      }),
    );
    expect(registry.capabilitiesOf("typescript")).toEqual({ documents: "tsdoc" });
  });

  it("invokes hooks with the restricted handle", () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();
    const registry = createSymbolExtractorRegistry();
    const hooked = extractor("ts", "typescript", 0, { onRegister, onUnregister });
    registry.register(hooked);
    expect(onRegister).toHaveBeenCalledTimes(1);
    const handle = onRegister.mock.calls[0]![0] as never;
    expect(handle).toHaveProperty("register");
    registry.unregister("ts");
    expect(onUnregister).toHaveBeenCalledTimes(1);
  });
});

describe("resolverSummary", () => {
  it("returns the winning metadata per language", () => {
    const registry = createSymbolExtractorRegistry();
    registry.register(extractor("ts", "typescript", 1));
    registry.register(extractor("ts-other", "typescript", 0));
    registry.register(extractor("js", "javascript"));
    const summary = resolverSummary(registry);
    expect(summary.map((metadata) => metadata.id)).toEqual(["ts", "js"]);
  });
});
