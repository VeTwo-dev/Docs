import { describe, it, expect } from "vitest";
import {
  REFERENCE_RESOLVER_CAPABILITIES,
  createReferenceResolver,
  isKnownReferenceCapability,
  type ReferenceResolver,
  type ReferenceBindingInput,
  type ReferenceBindingOutput,
} from "./index.js";

const BASE = {
  metadata: {
    id: "test",
    languageId: "typescript",
    displayName: "Test Resolver",
    version: "1.0.0",
    priority: 1,
    source: "external" as const,
  },
  capabilities: { "import-bindings": "full" as const },
  extractBindings: (input: ReferenceBindingInput): ReferenceBindingOutput => ({
    languageId: input.languageId,
    resolverId: "test",
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
};

function makeResolver(overrides: Partial<ReferenceResolver> = {}): ReferenceResolver {
  return { ...BASE, ...overrides };
}

describe("reference resolver contract", () => {
  it("freezes the resolver and its metadata", () => {
    const resolver = createReferenceResolver(makeResolver());
    expect(Object.isFrozen(resolver)).toBe(true);
    expect(Object.isFrozen(resolver.metadata)).toBe(true);
    expect(Object.isFrozen(resolver.capabilities)).toBe(true);
    expect(resolver.metadata.id).toBe("test");
  });

  it("carries optional hooks and minimumApiVersion", () => {
    const resolver = createReferenceResolver(
      makeResolver({
        hooks: { onRegister: () => {} },
        minimumApiVersion: "1.0",
      }),
    );
    expect(resolver.hooks?.onRegister).toBeTypeOf("function");
    expect(resolver.minimumApiVersion).toBe("1.0");
  });
});

describe("resolver capabilities", () => {
  it("lists the known capabilities", () => {
    expect(REFERENCE_RESOLVER_CAPABILITIES).toContain("import-bindings");
    expect(REFERENCE_RESOLVER_CAPABILITIES).toContain("re-exports");
    expect(isKnownReferenceCapability("default-imports")).toBe(true);
    expect(isKnownReferenceCapability("semantic")).toBe(false);
  });
});
