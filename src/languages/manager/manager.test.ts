import { describe, expect, it, vi } from "vitest";
import type { LanguageAdapter } from "../contracts/adapter.js";
import { createLanguageRegistry } from "../registry/index.js";
import { createLanguageManager, LanguageManager } from "./manager.js";

const pythonAdapter: LanguageAdapter = {
  metadata: {
    id: "python",
    displayName: "Python",
    priority: 3,
    extensions: [".py"],
    fileNames: ["setup.py"],
    configFiles: ["pyproject.toml", "setup.cfg"],
    mimeTypes: ["text/x-python"],
    defaultEntryFiles: ["main.py"],
  },
  capabilities: { scanning: true, typeSystem: "basic" },
  configuration: [{ files: ["pyproject.toml"] }],
  frameworkSupport: [{ id: "django", name: "Django", dependencies: ["django"] }],
};

function freshManager(): LanguageManager {
  return createLanguageManager({ autoRegisterBuiltins: false });
}

describe("LanguageManager", () => {
  it("registers built-in adapters by default", () => {
    const manager = createLanguageManager();
    expect(manager.has("typescript")).toBe(true);
    expect(manager.has("javascript")).toBe(true);
    expect(manager.size()).toBe(2);
  });

  it("skips built-ins when configured", () => {
    const manager = freshManager();
    expect(manager.size()).toBe(0);
  });

  it("register/get/has/size/all", () => {
    const manager = freshManager();
    manager.register(pythonAdapter);
    expect(manager.has("python")).toBe(true);
    expect(manager.get("python")?.displayName).toBe("Python");
    expect(manager.size()).toBe(1);
    expect(manager.all().map((m) => m.id)).toEqual(["python"]);
  });

  it("resolves by alias (case-insensitive)", () => {
    const manager = createLanguageManager();
    expect(manager.resolve("ts")?.id).toBe("typescript");
    expect(manager.resolve("TS")?.id).toBe("typescript");
    expect(manager.resolve("js")?.id).toBe("javascript");
    expect(manager.resolve("not-a-language")).toBeUndefined();
  });

  it("require throws with a missing-adapter message", () => {
    const manager = createLanguageManager();
    expect(() => manager.require("rust")).toThrow(/No language adapter/);
    expect(manager.require("typescript").id).toBe("typescript");
  });

  it("unregister removes the adapter", () => {
    const manager = freshManager();
    manager.register(pythonAdapter);
    expect(manager.unregister("python")).toBe(true);
    expect(manager.has("python")).toBe(false);
    expect(manager.unregister("python")).toBe(false);
  });

  it("runs lifecycle hooks", () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();
    const manager = freshManager();
    manager.register({
      metadata: { id: "hooked", displayName: "Hooked" },
      capabilities: {},
      hooks: { onRegister, onUnregister },
    });
    expect(onRegister).toHaveBeenCalledOnce();
    expect(onRegister.mock.calls[0]?.[0]?.get("hooked")?.displayName).toBe("Hooked");
    manager.unregister("hooked");
    expect(onUnregister).toHaveBeenCalledOnce();
  });

  it("handles async onRegister hooks without crashing", async () => {
    const manager = freshManager();
    const result = manager.register({
      metadata: { id: "async-hooked", displayName: "Async" },
      capabilities: {},
      hooks: { onRegister: async () => undefined },
    });
    expect(result.status).toBe("registered");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("records duplicate registration diagnostics", () => {
    const manager = createLanguageManager();
    manager.register(pythonAdapter);
    manager.register(pythonAdapter);
    const diagnostics = manager.getDiagnostics();
    expect(diagnostics.some((d) => d.code === "duplicate-registration")).toBe(true);
    manager.clearDiagnostics();
    expect(manager.getDiagnostics()).toEqual([]);
  });

  it("flags version-incompatible adapters", () => {
    const manager = createLanguageManager({ autoRegisterBuiltins: false, apiVersion: "1.0.0" });
    manager.register({
      metadata: { id: "future", displayName: "Future" },
      capabilities: {},
      minimumApiVersion: "2.0.0",
    });
    expect(manager.getDiagnostics().some((d) => d.code === "version-incompatibility")).toBe(true);
  });

  it("looks up by extension, mime, file name and framework", () => {
    const manager = freshManager();
    manager.register(pythonAdapter);
    expect(manager.byExtension(".py").map((m) => m.id)).toEqual(["python"]);
    expect(manager.byMimeType("text/x-python").map((m) => m.id)).toEqual(["python"]);
    expect(manager.byFileName("setup.py").map((m) => m.id)).toEqual(["python"]);
    expect(manager.byFramework("django").map((m) => m.id)).toEqual(["python"]);
  });

  it("exposes capabilities, levels, frameworks, configurations and comments", () => {
    const manager = createLanguageManager();
    expect(manager.capabilities("typescript")?.typeSystem).toBe("full");
    expect(manager.capabilities("missing")).toBeUndefined();
    expect(manager.hasCapability("typescript", "typeSystem")).toBe(true);
    expect(manager.hasCapability("typescript", "ast")).toBe(false);
    expect(manager.hasCapability("missing", "ast")).toBe(false);
    expect(manager.capabilityLevel("typescript", "compilation")).toBe(2);
    expect(manager.capabilityLevel("typescript", "ast")).toBe(0);
    expect(manager.capabilityLevel("missing", "ast")).toBe(0);
    expect(manager.frameworks("typescript").map((f) => f.id)).toContain("nextjs");
    expect(manager.frameworks("missing")).toEqual([]);
    expect(manager.configurations("typescript")[0]?.files).toContain("tsconfig.json");
    expect(manager.configurations("missing")).toEqual([]);
    expect(manager.commentStandards("typescript").map((c) => c.id)).toEqual(["jsdoc", "tsdoc"]);
    expect(manager.commentStandards("javascript").map((c) => c.id)).toEqual(["jsdoc"]);
    expect(manager.commentStandards("missing")).toEqual([]);
  });
});

describe("LanguageManager detection", () => {
  const manager = () => createLanguageManager({ autoRegisterBuiltins: false });

  it("detects a language by extension", () => {
    const m = manager();
    m.register(pythonAdapter);
    const results = m.detect({ files: ["src/main.py"] });
    expect(results).toHaveLength(1);
    expect(results[0]?.languageId).toBe("python");
    expect(results[0]?.confidence).toBeCloseTo(0.35);
    expect(results[0]?.signals[0]?.source).toBe("extension");
  });

  it("detects multiple languages in one project, ordered by confidence", () => {
    const m = createLanguageManager();
    m.register(pythonAdapter);
    const results = m.detect({
      files: ["src/index.ts", "src/util.js", "scripts/build.py"],
      configFiles: ["tsconfig.json"],
    });
    expect(results.map((r) => r.languageId)).toEqual(["typescript", "javascript", "python"]);
    expect(results[0]?.confidence).toBeGreaterThan(results[1]!.confidence);
  });

  it("collects extension + fileName + configFile signals", () => {
    const m = manager();
    m.register(pythonAdapter);
    const result = m.detectLanguage({
      files: ["main.py", "setup.py"],
      configFiles: ["pyproject.toml"],
    });
    expect(result?.languageId).toBe("python");
    const sources = result?.signals.map((s) => s.source);
    expect(sources).toContain("extension");
    expect(sources).toContain("fileName");
    expect(sources).toContain("configFile");
  });

  it("detects frameworks from dependencies", () => {
    const m = manager();
    m.register(pythonAdapter);
    const result = m.detectLanguage({ files: ["app.py"], dependencies: { django: "^5" } });
    expect(result?.frameworks).toEqual(["django"]);
    expect(result?.signals.some((s) => s.source === "dependency")).toBe(true);
  });

  it("detects frameworks from devDependencies", () => {
    const m = createLanguageManager();
    const result = m.detectLanguage({
      files: ["x.js"],
      devDependencies: { react: "^18" },
    });
    expect(result?.languageId).toBe("javascript");
    expect(result?.signals.some((s) => s.source === "devDependency")).toBe(true);
  });

  it("uses lockfile, workspace, repository and explicit framework signals", () => {
    const m = createLanguageManager();
    const result = m.detectLanguage({
      files: ["package.json"],
      lockfiles: ["pnpm-lock.yaml"],
      workspace: { monorepo: true, packages: ["packages/*"] },
      repository: { language: "TypeScript", topics: ["nextjs"] },
      frameworks: ["nextjs"],
    });
    expect(result?.languageId).toBe("typescript");
    const sources = result?.signals.map((s) => s.source) ?? [];
    expect(sources).toContain("lockfile");
    expect(sources).toContain("workspace");
    expect(sources).toContain("repository");
    expect(sources).toContain("framework");
    expect(result?.frameworks).toContain("nextjs");
  });

  it("prefers an explicit repository language signal", () => {
    const m = manager();
    m.register(pythonAdapter);
    const result = m.detectLanguage({
      files: ["something.rs"],
      repository: { language: "python" },
    });
    expect(result?.languageId).toBe("python");
    expect(result?.signals.some((s) => s.source === "repository")).toBe(true);
  });

  it("uses the custom detect hook when present", () => {
    const m = manager();
    m.register({
      metadata: { id: "custom", displayName: "Custom" },
      capabilities: {},
      detect: () => ({
        languageId: "custom",
        confidence: 0.9,
        signals: [{ source: "custom", weight: 0.9, detail: "hand-rolled" }],
        frameworks: [],
      }),
    });
    const results = m.detect({ files: ["anything.xyz"] });
    expect(results[0]?.languageId).toBe("custom");
    expect(results[0]?.confidence).toBe(0.9);
  });

  it("skips languages whose custom detect returns null", () => {
    const m = manager();
    m.register(pythonAdapter);
    m.register({
      metadata: { id: "off", displayName: "Off" },
      capabilities: {},
      detect: () => null,
    });
    const results = m.detect({ files: ["a.py"] });
    expect(results.map((r) => r.languageId)).toEqual(["python"]);
  });

  it("returns an empty list for unknown languages", () => {
    const m = manager();
    expect(m.detect({ files: ["file.unknownext"] })).toEqual([]);
  });

  it("clamps confidence to 1 and caches per fingerprint", () => {
    const m = createLanguageManager();
    const input = {
      files: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
      configFiles: ["tsconfig.json"],
      dependencies: { next: "^15" },
    };
    const first = m.detect(input);
    const cached = m.detect(input);
    expect(cached).toBe(first);
    expect(first[0]?.confidence).toBe(1);
    m.clearCache();
    expect(m.detect(input)).not.toBe(first);
  });

  it("does not cache when caching is disabled", () => {
    const m = createLanguageManager({ autoRegisterBuiltins: false, cache: false });
    m.register(pythonAdapter);
    const input = { files: ["a.py"] };
    expect(m.detect(input)).not.toBe(m.detect(input));
  });

  it("diagnoses unsupported extensions, unknown and missing languages", () => {
    const m = manager();
    m.register(pythonAdapter);
    const unsupported = m.diagnoseUnsupported([".py", ".rs", ".rs"]);
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]?.code).toBe("unsupported-language");
    const unknown = m.diagnoseUnknown(["python", "cobol"]);
    expect(unknown.map((d) => d.code)).toEqual(["unknown-language"]);
    expect(unknown[0]?.languageId).toBe("cobol");
    const missing = m.diagnoseMissing(["python", "rust"]);
    expect(missing.map((d) => d.code)).toEqual(["missing-adapter"]);
  });
});

describe("LanguageManager lifecycle", () => {
  it("initialize/dispose reset readiness, caches and diagnostics but keep adapters", async () => {
    const m = freshManager();
    expect(m.isReady).toBe(false);
    await m.initialize();
    expect(m.isReady).toBe(true);
    m.register(pythonAdapter);
    const input = { files: ["a.py"] };
    const cached = m.detect(input);
    await m.dispose();
    expect(m.isReady).toBe(false);
    expect(m.has("python")).toBe(true);
    expect(m.detect(input)).not.toBe(cached);
  });

  it("can be constructed with a shared registry", () => {
    const registry = createLanguageRegistry();
    const m = new LanguageManager({ registry, autoRegisterBuiltins: false });
    m.register(pythonAdapter);
    expect(registry.has("python")).toBe(true);
  });
});
