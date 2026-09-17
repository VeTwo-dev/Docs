import { describe, it, expect } from "vitest";
import type { Plugin, HookContext } from "../types/internal.js";
import { defineDocs } from "../config/define.js";
import { createPluginRegistry, createBuiltinPlugins } from "./index.js";

function makePlugin(name: string, hooks?: Partial<Plugin["hooks"]>): Plugin {
  return {
    name,
    version: "0.1.0",
    hooks: hooks ?? {},
  };
}

describe("createPluginRegistry", () => {
  it("register adds a plugin", () => {
    const registry = createPluginRegistry();
    const plugin = makePlugin("test-plugin");

    registry.register(plugin);

    expect(registry.getPlugins()).toHaveLength(1);
    expect(registry.getPlugins()[0]!.name).toBe("test-plugin");
  });

  it("registerAll adds multiple plugins", () => {
    const registry = createPluginRegistry();
    const plugins = [makePlugin("plugin-a"), makePlugin("plugin-b"), makePlugin("plugin-c")];

    registry.registerAll(plugins);

    expect(registry.getPlugins()).toHaveLength(3);
  });

  it("ignores duplicate plugin names", () => {
    const registry = createPluginRegistry();
    const plugin1 = makePlugin("same-name");
    const plugin2 = makePlugin("same-name");

    registry.register(plugin1);
    registry.register(plugin2);

    expect(registry.getPlugins()).toHaveLength(1);
  });

  it("getPlugins returns a copy", () => {
    const registry = createPluginRegistry();
    registry.register(makePlugin("p1"));

    const plugins = registry.getPlugins();
    plugins.push(makePlugin("p2"));

    expect(registry.getPlugins()).toHaveLength(1);
  });

  it("getHooksFor returns handlers for a hook", () => {
    const handler = (_ctx: HookContext) => {};
    const registry = createPluginRegistry();
    registry.register(makePlugin("test-plugin", { generate: handler }));

    const hooks = registry.getHooksFor("generate");

    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.plugin).toBe("test-plugin");
    expect(hooks[0]!.handler).toBe(handler);
  });

  it("getHooksFor returns empty for hooks with no handlers", () => {
    const registry = createPluginRegistry();
    registry.register(makePlugin("test-plugin"));

    const hooks = registry.getHooksFor("generate");

    expect(hooks).toHaveLength(0);
  });

  it("getHooksFor collects from multiple plugins", () => {
    const handler1 = (_ctx: HookContext) => {};
    const handler2 = (_ctx: HookContext) => {};
    const registry = createPluginRegistry();
    registry.register(makePlugin("p1", { load: handler1 }));
    registry.register(makePlugin("p2", { load: handler2 }));

    const hooks = registry.getHooksFor("load");

    expect(hooks).toHaveLength(2);
    expect(hooks[0]!.plugin).toBe("p1");
    expect(hooks[1]!.plugin).toBe("p2");
  });
});

describe("createBuiltinPlugins", () => {
  it("returns search plugin when search.enabled is true", () => {
    const config = defineDocs({
      search: { enabled: true, indexFields: ["title"], maxResults: 10 },
    });

    const plugins = createBuiltinPlugins(config);

    const searchPlugin = plugins.find((p) => p.name === "@vetwo/docs/search");
    expect(searchPlugin).toBeDefined();
    expect(searchPlugin!.version).toBe("0.1.0");
    expect(searchPlugin!.hooks.generate).toBeDefined();
  });

  it("does not return search plugin when search.enabled is false", () => {
    const config = defineDocs({ search: { enabled: false, indexFields: [], maxResults: 0 } });

    const plugins = createBuiltinPlugins(config);

    const searchPlugin = plugins.find((p) => p.name === "@vetwo/docs/search");
    expect(searchPlugin).toBeUndefined();
  });

  it("returns api-docs plugin when api.enabled is true", () => {
    const config = defineDocs({
      api: { enabled: true, source: "./src", include: [], exclude: [], readme: true },
    });

    const plugins = createBuiltinPlugins(config);

    const apiPlugin = plugins.find((p) => p.name === "@vetwo/docs/api-docs");
    expect(apiPlugin).toBeDefined();
  });

  it("returns empty when no features enabled", () => {
    const config = defineDocs({
      search: { enabled: false, indexFields: [], maxResults: 0 },
      api: { enabled: false, source: "./src", include: [], exclude: [], readme: true },
    });

    const plugins = createBuiltinPlugins(config);

    expect(plugins).toHaveLength(0);
  });
});
