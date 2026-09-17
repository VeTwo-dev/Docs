import { describe, expect, it } from "vitest";
import { createLanguageManager } from "./manager/index.js";
import { createLanguageRegistry } from "./registry/index.js";
import {
  createLanguageAdapter,
  javascriptAdapter,
  registerLanguage,
  typescriptAdapter,
} from "./index.js";

describe("languages facade", () => {
  it("registers a language adapter via the extension API", () => {
    const manager = createLanguageManager({ autoRegisterBuiltins: false });
    const result = registerLanguage(
      createLanguageAdapter({
        metadata: { id: "python", displayName: "Python", extensions: [".py"] },
        capabilities: { scanning: true },
      }),
      manager,
    );
    expect(result.status).toBe("registered");
    expect(manager.has("python")).toBe(true);
  });

  it("exposes built-in adapters and registry", () => {
    expect(typescriptAdapter.metadata.id).toBe("typescript");
    expect(javascriptAdapter.metadata.id).toBe("javascript");
    const registry = createLanguageRegistry();
    expect(registry.size()).toBe(0);
  });

  it("createLanguageAdapter freezes external adapters", () => {
    const adapter = createLanguageAdapter({
      metadata: { id: "rust", displayName: "Rust" },
      capabilities: {},
    });
    expect(Object.isFrozen(adapter)).toBe(true);
  });
});
