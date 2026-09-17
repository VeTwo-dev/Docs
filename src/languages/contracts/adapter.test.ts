import { describe, expect, it } from "vitest";
import { createLanguageAdapter } from "./adapter.js";

const baseAdapter = () =>
  createLanguageAdapter({
    metadata: { id: "typescript", displayName: "TypeScript" },
    capabilities: { scanning: true },
  });

describe("createLanguageAdapter", () => {
  it("returns a frozen adapter preserving metadata and capabilities", () => {
    const adapter = baseAdapter();
    expect(adapter.metadata.id).toBe("typescript");
    expect(adapter.metadata.displayName).toBe("TypeScript");
    expect(adapter.capabilities.scanning).toBe(true);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it("keeps optional extension fields", () => {
    const adapter = createLanguageAdapter({
      metadata: { id: "js", displayName: "JavaScript", extensions: [".js"] },
      capabilities: {},
      minimumApiVersion: "1.0.0",
      configuration: { files: ["jsconfig.json"] },
    });
    expect(adapter.metadata.extensions).toEqual([".js"]);
    expect(adapter.minimumApiVersion).toBe("1.0.0");
    expect(adapter.configuration).toEqual({ files: ["jsconfig.json"] });
  });

  it("does not share the input object with the returned adapter", () => {
    const input = {
      metadata: { id: "x", displayName: "X" },
      capabilities: { scanning: true },
    };
    const adapter = createLanguageAdapter(input);
    expect(adapter).not.toBe(input);
  });
});
