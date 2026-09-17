import { describe, it, expect } from "vitest";
import { createCompilerManager } from "../manager/index.js";
import { createCompilerAdapter, type CompilerAdapter } from "../contracts/adapter.js";
import { createLanguageManager } from "../../languages/index.js";
import { createCompilationUnit } from "../models/unit.js";
import type { NativeCompilationOutput } from "../contracts/adapter.js";
import type { CompileRequest } from "../contracts/request.js";
import { hashContent } from "../shared/hash.js";

const ROOT = "/project";

function request(
  files: readonly string[],
  contents: Readonly<Record<string, string>>,
  overrides: Partial<CompileRequest> = {},
): CompileRequest {
  return { rootDir: ROOT, files, contents, ...overrides };
}

describe("CompilerManager", () => {
  it("registers the built-in TypeScript and JavaScript compilers by default", () => {
    const manager = createCompilerManager();
    expect(manager.size()).toBe(2);
    expect(manager.has("typescript")).toBe(true);
    expect(manager.has("javascript")).toBe(true);
    expect(manager.resolve("typescript")?.metadata.id).toBe("typescript");
    expect(manager.resolve("javascript")?.metadata.id).toBe("javascript");
    expect(manager.byCapability("diagnostics")).toHaveLength(2);
    expect(manager.byExtension(".ts")[0]?.metadata.id).toBe("typescript");
  });

  it("does not register built-ins when disabled", () => {
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    expect(manager.size()).toBe(0);
  });

  it("compiles a single TypeScript file in-memory", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(["src/a.ts"], { "src/a.ts": "export const a: number = 1;" }),
    );
    expect(result.ok).toBe(true);
    expect(result.compilerId).toBe("typescript");
    expect(result.languageId).toBe("typescript");
    expect(result.units).toHaveLength(1);
    expect(result.units[0]!.status).toBe("ok");
    expect(result.units[0]!.syntaxTree).toBeDefined();
    expect(result.units[0]!.syntaxTree!.root.kind).toBe("SourceFile");
    expect(result.units[0]!.hash).toBe(hashContent("export const a: number = 1;"));
    expect(result.statistics.totalFiles).toBe(1);
    expect(result.statistics.compiledFiles).toBe(1);
    expect(result.statistics.nativeVersion).toBeTypeOf("string");
    await manager.dispose();
  });

  it("compiles a single JavaScript file via Babel", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(["src/a.js"], { "src/a.js": "export const a = 1;" }),
    );
    expect(result.ok).toBe(true);
    expect(result.compilerId).toBe("javascript");
    expect(result.units[0]!.syntaxTree!.format).toBe("ecmascript");
    expect(result.units[0]!.syntaxTree!.root.kind).toBe("Program");
    await manager.dispose();
  });

  it("detects the language from file extensions when omitted", async () => {
    const manager = createCompilerManager({ languages: createLanguageManager() });
    const result = await manager.compile(
      request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }),
    );
    expect(result.languageId).toBe("typescript");
    await manager.dispose();
  });

  it("resolves an explicit compilerId", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(
        ["src/a.js"],
        { "src/a.js": "export const a = 1;" },
        {
          compilerId: "typescript",
        },
      ),
    );
    expect(result.compilerId).toBe("typescript");
    await manager.dispose();
  });

  it("reports a missing-compiler result without throwing", async () => {
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    const result = await manager.compile(
      request(
        ["src/a.unknown"],
        { "src/a.unknown": "x" },
        {
          languageId: "nope",
        },
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.failedFiles).toEqual(["src/a.unknown"]);
    expect(result.diagnostics[0]?.code).toBe("missing-compiler");
    expect(result.diagnostics[0]?.severity).toBe("error");
    await manager.dispose();
  });

  it("skips files outside the compiler's extensions with a warning", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(["src/a.ts", "README.md"], {
        "src/a.ts": "export const a = 1;",
        "README.md": "# hello",
      }),
    );
    expect(result.units).toHaveLength(2);
    expect(result.skippedFiles).toEqual(["README.md"]);
    const skipped = result.units.find((u) => u.file === "README.md");
    expect(skipped?.status).toBe("skipped");
    expect(result.diagnostics.some((d) => d.code === "unsupported-syntax")).toBe(true);
    await manager.dispose();
  });

  it("fails gracefully on TypeScript syntax errors", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(request(["src/a.ts"], { "src/a.ts": "const x: = 1;" }));
    expect(result.ok).toBe(false);
    expect(result.failedFiles).toEqual(["src/a.ts"]);
    expect(result.units[0]!.status).toBe("failed");
    expect(result.units[0]!.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(result.units[0]!.diagnostics[0]?.file).toBe("src/a.ts");
    await manager.dispose();
  });

  it("reports a normalized Babel syntax error", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(request(["src/a.js"], { "src/a.js": "const x = ;" }));
    expect(result.ok).toBe(false);
    expect(result.failedFiles).toEqual(["src/a.js"]);
    const diagnostic = result.units[0]!.diagnostics[0]!;
    expect(diagnostic.code).toBe("syntax-error");
    expect(diagnostic.range?.start).toBeDefined();
    await manager.dispose();
  });

  it("recovers after a failed compile", async () => {
    const manager = createCompilerManager();
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "const x: = 1;" }));
    const good = await manager.compile(
      request(["src/a.ts"], { "src/a.ts": "export const ok = 1;" }),
    );
    expect(good.ok).toBe(true);
    expect(good.units[0]!.status).toBe("ok");
    await manager.dispose();
  });

  it("produces a source map when requested for TypeScript", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(
        ["src/a.ts"],
        { "src/a.ts": "export const a = 1;" },
        {
          options: { sourceMaps: true },
        },
      ),
    );
    expect(result.units[0]!.sourceMap?.version).toBe(3);
    expect(result.units[0]!.sourceMap!.sources).toContain("src/a.ts");
    expect(result.units[0]!.sourceMap!.mappings.length).toBeGreaterThan(0);
    await manager.dispose();
  });

  it("serves unchanged files from cache on the second compile", async () => {
    const manager = createCompilerManager();
    const contents = { "src/a.ts": "export const a = 1;" };
    const first = await manager.compile(request(["src/a.ts"], contents));
    expect(first.statistics.cached).toBe(false);

    const second = await manager.compile(request(["src/a.ts"], contents));
    expect(second.statistics.cached).toBe(true);
    expect(second.cachedFiles).toEqual(["src/a.ts"]);
    expect(second.statistics.cachedFiles).toBe(1);
    expect(second.statistics.compiledFiles).toBe(0);
    expect(second.units[0]!.hash).toBe(first.units[0]!.hash);
    await manager.dispose();
  });

  it("detects changed files and reports them", async () => {
    const manager = createCompilerManager();
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }));
    const changed = await manager.compile(
      request(["src/a.ts"], { "src/a.ts": "export const a = 2;" }),
    );
    expect(changed.changedFiles).toEqual(["src/a.ts"]);
    expect(changed.statistics.cached).toBe(false);
    await manager.dispose();
  });

  it("recompiles transitive dependents of a changed file", async () => {
    const manager = createCompilerManager();
    const contents = {
      "src/index.ts": 'import { b } from "./b";\nexport const x = b;',
      "src/b.ts": "export const b = 1;",
    };
    await manager.compile(request(["src/index.ts", "src/b.ts"], contents));

    const changed = await manager.compile(
      request(["src/index.ts", "src/b.ts"], {
        ...contents,
        "src/b.ts": "export const b = 2;",
      }),
    );
    expect(changed.changedFiles).toEqual(["src/b.ts"]);
    expect(changed.statistics.compiledFiles).toBe(2);
    await manager.dispose();
  });

  it("emits watch events during compilation", async () => {
    const manager = createCompilerManager();
    const events: string[] = [];
    const recompiled: string[] = [];
    const { off } = manager.on("compilation-started", () => events.push("started"));
    manager.on("compilation-finished", () => events.push("finished"));
    manager.on("compilation-failed", () => events.push("failed"));
    manager.on("file-recompiled", (payload) => recompiled.push(payload.file));

    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }));
    expect(events).toEqual(["started", "finished"]);
    expect(recompiled).toEqual(["src/a.ts"]);

    off();
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 2;" }));
    expect(events).toEqual(["started", "finished", "finished"]);
    await manager.dispose();
  });

  it("emits project-updated when files change", async () => {
    const manager = createCompilerManager();
    const updates: Array<{ changed: readonly string[] }> = [];
    manager.on("project-updated", (payload) => updates.push(payload));
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }));
    expect(updates).toHaveLength(1);
    expect(updates[0]!.changed).toEqual(["src/a.ts"]);
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 2;" }));
    expect(updates).toHaveLength(2);
    expect(updates[1]!.changed).toEqual(["src/a.ts"]);
    await manager.dispose();
  });

  it("emits compilation-failed when a request fails", async () => {
    const manager = createCompilerManager();
    const failed: string[] = [];
    manager.on("compilation-failed", () => failed.push("x"));
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "const x: = 1;" }));
    expect(failed).toHaveLength(1);
    await manager.dispose();
  });

  it("captures workspace context", async () => {
    const manager = createCompilerManager();
    const result = await manager.compile(
      request(
        ["src/a.ts"],
        { "src/a.ts": "export const a = 1;" },
        {
          workspace: { manager: "pnpm", monorepo: true, packages: ["pkg-a"] },
        },
      ),
    );
    expect(result.context.workspace?.monorepo).toBe(true);
    expect(result.context.workspace?.manager).toBe("pnpm");
    await manager.dispose();
  });

  it("can be disposed and reused for subsequent compiles", async () => {
    const manager = createCompilerManager();
    await manager.compile(request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }));
    expect(manager.isReady).toBe(false);
    await manager.initialize();
    expect(manager.isReady).toBe(true);
    const result = await manager.compile(
      request(["src/a.ts"], { "src/a.ts": "export const a = 1;" }),
    );
    expect(result.ok).toBe(true);
    await manager.dispose();
  });

  it("respects skipCache", async () => {
    const manager = createCompilerManager();
    const contents = { "src/a.ts": "export const a = 1;" };
    await manager.compile(request(["src/a.ts"], contents));
    const second = await manager.compile(
      request(["src/a.ts"], contents, { options: { skipCache: true } }),
    );
    expect(second.statistics.cached).toBe(false);
    await manager.dispose();
  });

  it("invalidates cache entries", async () => {
    const manager = createCompilerManager();
    const contents = { "src/a.ts": "export const a = 1;" };
    await manager.compile(request(["src/a.ts"], contents));
    manager.invalidate("typescript", "src/a.ts");
    const after = await manager.compile(request(["src/a.ts"], contents));
    expect(after.statistics.cached).toBe(false);
    await manager.dispose();
  });

  it("reports registration diagnostics and replaces adapters", () => {
    const manager = createCompilerManager();
    const custom = createCompilerAdapter({
      metadata: {
        id: "custom",
        displayName: "Custom",
        languageId: "custom",
        version: "1.0.0",
        priority: 1,
        extensions: [".cust"],
        syntax: ["custom"],
      },
      capabilities: { parsing: "full" },
      compile: async () => ({ units: [], dependencies: {}, failedFiles: [], diagnostics: [] }),
    });
    const first = manager.register(custom);
    expect(first.status).toBe("registered");
    expect(manager.has("custom")).toBe(true);

    const second = manager.register(custom);
    expect(second.status).toBe("replaced");

    expect(manager.unregister("custom")).toBe(true);
    expect(manager.has("custom")).toBe(false);
  });

  it("rejects invalid adapters without storing them", () => {
    const manager = createCompilerManager();
    const bad = createCompilerAdapter({
      metadata: {
        id: "bad!",
        displayName: "Bad",
        languageId: "x",
        version: "1.0.0",
        priority: 1,
        extensions: [".x"],
        syntax: [],
      },
      capabilities: { parsing: "full" },
      compile: async () => ({ units: [], dependencies: {}, failedFiles: [], diagnostics: [] }),
    });
    const result = manager.register(bad);
    expect(result.status).toBe("invalid");
    expect(manager.has("bad!")).toBe(false);
  });

  it("routes compiles through an incremental session and reuses parsed files", async () => {
    let parseCount = 0;
    const adapter: CompilerAdapter = createCompilerAdapter({
      metadata: {
        id: "session-test",
        displayName: "Session Test",
        languageId: "session-test",
        version: "1.0.0",
        priority: 1,
        extensions: [".st"],
        syntax: [],
      },
      capabilities: { parsing: "full", incremental: "full" },
      compile: async (input) => {
        parseCount += input.files.length;
        return {
          units: input.files.map((file) =>
            createCompilationUnit({
              file,
              languageId: input.languageId,
              compilerId: "session-test",
              hash: hashContent(input.contents[file] ?? ""),
            }),
          ),
          dependencies: {},
          failedFiles: [],
          diagnostics: [],
        };
      },
      createIncrementalSession: () => ({
        compilerId: "session-test",
        compile: async (input) => {
          parseCount += input.files.length;
          return {
            units: input.files.map((file) =>
              createCompilationUnit({
                file,
                languageId: input.languageId,
                compilerId: "session-test",
                hash: hashContent(input.contents[file] ?? ""),
              }),
            ),
            dependencies: {},
            failedFiles: [],
            diagnostics: [],
          };
        },
        dispose: () => undefined,
      }),
    });
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    manager.register(adapter);
    const contents = { "src/a.st": "hello" };
    await manager.compile(request(["src/a.st"], contents));
    const compiled = parseCount;
    await manager.compile(request(["src/a.st"], contents));
    expect(parseCount).toBe(compiled);
    await manager.dispose();
  });

  it("recovers from a throwing adapter with a compilation-failed diagnostic", async () => {
    const adapter = createCompilerAdapter({
      metadata: {
        id: "throwing",
        displayName: "Throwing",
        languageId: "throwing",
        version: "1.0.0",
        priority: 1,
        extensions: [".thr"],
        syntax: [],
      },
      capabilities: { parsing: "full" },
      compile: async () => {
        throw new Error("adapter exploded");
      },
    });
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    manager.register(adapter);
    const result = await manager.compile(request(["src/a.thr"], { "src/a.thr": "x" }));
    expect(result.ok).toBe(false);
    expect(result.failedFiles).toEqual(["src/a.thr"]);
    expect(result.diagnostics[0]?.code).toBe("compilation-failed");
    expect(result.diagnostics[0]?.message).toBe("adapter exploded");
    await manager.dispose();
  });

  it("emits a custom event through emit()", () => {
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    let received: unknown;
    const { off } = manager.on("file-recompiled", (payload) => {
      received = payload;
    });
    manager.emit("file-recompiled", {
      requestId: "r",
      compilerId: "x",
      languageId: "y",
      file: "a.ts",
      status: "ok",
      timestamp: 1,
    });
    expect((received as { file?: string }).file).toBe("a.ts");
    off();
  });

  it("exposes capability lookups", () => {
    const manager = createCompilerManager();
    expect(manager.hasCapability("typescript", "generics")).toBe(true);
    expect(manager.capabilityLevel("typescript", "parsing")).toBe(2);
    expect(manager.hasCapability("javascript", "generics")).toBe(false);
  });

  it("require() throws for unknown resolvers", () => {
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    expect(() => manager.require("missing")).toThrow();
  });

  it("clears diagnostics", () => {
    const manager = createCompilerManager({ autoRegisterBuiltins: false });
    const result = manager.register({
      metadata: {
        id: "bad!",
        displayName: "Bad",
        languageId: "x",
        version: "1.0.0",
        priority: 1,
        extensions: [".x"],
        syntax: [],
      },
      capabilities: { parsing: "full" },
      compile: async (): Promise<NativeCompilationOutput> => ({
        units: [],
        dependencies: {},
        failedFiles: [],
        diagnostics: [],
      }),
    });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(manager.getDiagnostics().length).toBeGreaterThan(0);
    manager.clearDiagnostics();
    expect(manager.getDiagnostics()).toEqual([]);
  });
});
