import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATE_NAMESPACES,
  DEFAULT_REGISTRY,
  createStateNamespaceRegistry,
  registerStateNamespace,
  namespaceSegments,
  type NamespaceDefinition,
} from "./registry.js";

const EXAMPLE: NamespaceDefinition = {
  id: "plugin:acme",
  version: 1,
  retention: "cache",
  category: "cache",
  label: "Acme plugin state",
};

describe("state/registry", () => {
  it("default registry covers all built-in namespaces", () => {
    const ids = DEFAULT_REGISTRY.list().map((d) => d.id);
    for (const id of ["scanner", "compiler", "generator", "manifests", "temporary", "ai"]) {
      expect(ids).toContain(id);
    }
    expect(DEFAULT_STATE_NAMESPACES.length).toBe(DEFAULT_REGISTRY.list().length);
  });

  it("namespaceSegments maps plugin and ai ids hierarchically", () => {
    expect(namespaceSegments("scanner")).toEqual(["scanner"]);
    expect(namespaceSegments("plugin:acme")).toEqual(["plugins", "acme"]);
    expect(namespaceSegments("ai:openwiki")).toEqual(["ai", "providers", "openwiki"]);
  });

  it("registers, looks up and lists definitions", () => {
    const registry = createStateNamespaceRegistry();
    expect(registry.isRegistered("plugin:acme")).toBe(false);
    registerStateNamespace(EXAMPLE, registry);
    expect(registry.isRegistered("plugin:acme")).toBe(true);
    expect(registry.get("plugin:acme")).toEqual(EXAMPLE);
    expect(registry.list()).toContainEqual(EXAMPLE);
  });

  it("re-registering an id replaces its definition", () => {
    const registry = createStateNamespaceRegistry([EXAMPLE]);
    registerStateNamespace({ ...EXAMPLE, version: 2 }, registry);
    expect(registry.get("plugin:acme")?.version).toBe(2);
  });

  it("unregistered ids resolve to a flat segment and read as undefined", () => {
    const registry = createStateNamespaceRegistry();
    expect(registry.segments("future-ns")).toEqual(["future-ns"]);
    expect(registry.get("future-ns")).toBeUndefined();
  });

  it("registerStateNamespace defaults to the shared registry", () => {
    const probe: NamespaceDefinition = {
      id: "plugin:probe",
      version: 1,
      retention: "persistent",
      category: "generated-internal",
    };
    registerStateNamespace(probe);
    expect(DEFAULT_REGISTRY.isRegistered("plugin:probe")).toBe(true);
  });
});
