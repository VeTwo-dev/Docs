import { describe, expect, it } from "vitest";
import type { LanguageAdapter } from "../contracts/adapter.js";
import { createLanguageModel } from "./language.js";

const fullAdapter: LanguageAdapter = {
  metadata: {
    id: "typescript",
    displayName: "TypeScript",
    aliases: ["ts", "TS"],
    version: "1.0.0",
    priority: 10,
    extensions: [".ts", ".TS", "tsx"],
    fileNames: ["tsconfig.json"],
    mimeTypes: ["application/typescript"],
    lockfiles: ["package-lock.json"],
    configFiles: ["tsconfig.json", "tsconfig.json"],
    defaultEntryFiles: ["index.ts", "main.ts"],
    color: "#3178c6",
    icon: "typescript",
  },
  capabilities: { scanning: true, custom: "x" },
  configuration: [
    { files: ["tsconfig.json"], description: "a" },
    { files: ["tsconfig.build.json"] },
  ],
  commentStandards: [{ id: "tsdoc", name: "TSDoc", style: "docblock" }],
  frameworkSupport: [{ id: "nextjs", name: "Next.js", dependencies: ["next"] }],
  minimumApiVersion: "1.0.0",
};

describe("createLanguageModel", () => {
  it("normalises extensions (leading dot + lowercase) and deduplicates", () => {
    const model = createLanguageModel(fullAdapter);
    expect(model.extensions).toEqual([".ts", ".tsx"]);
  });

  it("lowercases aliases, mime types and the id", () => {
    const model = createLanguageModel(fullAdapter);
    expect(model.aliases).toEqual(["ts"]);
    expect(model.mimeTypes).toEqual(["application/typescript"]);
    expect(model.id).toBe("typescript");
  });

  it("deduplicates config files and entry files", () => {
    const model = createLanguageModel(fullAdapter);
    expect(model.configFiles).toEqual(["tsconfig.json"]);
    expect(model.entryFiles).toEqual(["index.ts", "main.ts"]);
  });

  it("defaults priority and preserves metadata fields", () => {
    const model = createLanguageModel(fullAdapter);
    expect(model.priority).toBe(10);
    expect(model.version).toBe("1.0.0");
    expect(model.color).toBe("#3178c6");
    expect(model.icon).toBe("typescript");
    expect(model.minimumApiVersion).toBe("1.0.0");
  });

  it("normalises a single configuration into an array", () => {
    const model = createLanguageModel(fullAdapter);
    expect(model.configuration).toHaveLength(2);
    expect(model.configuration[0]?.description).toBe("a");
  });

  it("exposes immutable nested models", () => {
    const model = createLanguageModel(fullAdapter);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.capabilities)).toBe(true);
    expect(Object.isFrozen(model.configuration[0])).toBe(true);
    expect(Object.isFrozen(model.commentStandards[0])).toBe(true);
    expect(Object.isFrozen(model.frameworkSupport[0])).toBe(true);
    expect(model.frameworkSupport[0]?.dependencies).toEqual(["next"]);
  });

  it("fills defaults for a minimal adapter", () => {
    const model = createLanguageModel({
      metadata: { id: "python", displayName: "Python" },
      capabilities: {},
    });
    expect(model.extensions).toEqual([]);
    expect(model.fileNames).toEqual([]);
    expect(model.configFiles).toEqual([]);
    expect(model.entryFiles).toEqual([]);
    expect(model.priority).toBe(0);
    expect(model.frameworkSupport).toEqual([]);
    expect(model.commentStandards).toEqual([]);
    expect(model.configuration).toEqual([]);
    expect(model.version).toBeUndefined();
  });
});
