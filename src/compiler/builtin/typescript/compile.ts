import type * as ts from "typescript";
import type { AdapterCompileInput, NativeCompilationOutput } from "../../contracts/adapter.js";
import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
} from "../../contracts/diagnostics.js";
import { normalizeCompilerDiagnostics } from "../../diagnostics/normalize.js";
import { createCompilationUnit } from "../../models/unit.js";
import { resolveSpecifiers } from "../../shared/dependencies.js";
import { hashContent } from "../../shared/hash.js";
import { nowMs } from "../../shared/time.js";
import { limitsFromOptions } from "../../shared/tree.js";
import { extractTsModuleSpecifiers } from "./dependencies.js";
import {
  loadTypeScript,
  scriptKindFor,
  TYPESCRIPT_EXTENSIONS,
  type TypeScriptModule,
} from "./native.js";
import { transpileSourceMap } from "./sourcemap.js";
import { buildTypeScriptTree } from "./tree.js";

/** A parsed TypeScript source file with its content hash. */
export interface TypeScriptSourceEntry {
  readonly file: string;
  readonly hash: string;
  readonly sourceFile: ts.SourceFile;
}

/** Compiler-level diagnostics when the TypeScript module cannot be loaded. */
export function missingTypeScriptDiagnostic(languageId: string): CompilerDiagnostic {
  return createCompilerDiagnostic({
    code: CompilerDiagnosticCode.MissingCompiler,
    severity: "error",
    message: `The "typescript" compiler is not available. Install the "typescript" package.`,
    compilerId: "typescript",
    languageId,
  });
}

/** Enriches TypeScript diagnostics with 1-based line/column ranges. */
function enrichTsDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  sourceFile: ts.SourceFile,
): readonly ts.Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    if (diagnostic.start === undefined || diagnostic.length === undefined) return diagnostic;
    const start = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    const end = sourceFile.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);
    return {
      ...diagnostic,
      range: Object.freeze({
        start: Object.freeze({
          line: start.line + 1,
          column: start.character + 1,
          offset: diagnostic.start,
        }),
        end: Object.freeze({
          line: end.line + 1,
          column: end.character + 1,
          offset: diagnostic.start + diagnostic.length,
        }),
      }),
    } as ts.Diagnostic;
  });
}

/** Compiles a set of parsed entries into the common output shape. */
export function compileTypeScriptEntries(
  input: AdapterCompileInput,
  entries: readonly TypeScriptSourceEntry[],
  ts: TypeScriptModule,
): NativeCompilationOutput {
  const context = { compilerId: "typescript", languageId: input.languageId };
  const limits = limitsFromOptions(input.options);
  const knownFiles = new Set(input.files);
  const units = [];
  const dependencies: Record<string, readonly string[]> = {};
  const failedFiles: string[] = [];

  for (const entry of entries) {
    const fileStarted = nowMs();
    const { file, hash, sourceFile } = entry;
    const rawDiagnostics =
      (sourceFile as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    const diagnostics = normalizeCompilerDiagnostics(
      enrichTsDiagnostics(rawDiagnostics, sourceFile),
      { ...context, defaultFile: file },
    );
    const status = diagnostics.some((d) => d.severity === "error") ? "failed" : "ok";
    if (status === "failed") failedFiles.push(file);
    dependencies[file] = resolveSpecifiers(
      input.rootDir,
      file,
      extractTsModuleSpecifiers(sourceFile, ts),
      [...TYPESCRIPT_EXTENSIONS, ".js", ".jsx", ".mjs", ".cjs"],
      knownFiles,
    );
    units.push(
      createCompilationUnit({
        file,
        languageId: input.languageId,
        compilerId: "typescript",
        status,
        syntaxTree: buildTypeScriptTree(sourceFile, ts, limits),
        diagnostics,
        ...(input.options?.sourceMaps === true
          ? {
              sourceMap: transpileSourceMap(sourceFile.text, file, input.options, ts),
            }
          : {}),
        hash,
        compileTimeMs: nowMs() - fileStarted,
      }),
    );
  }

  return {
    units,
    dependencies,
    failedFiles,
    diagnostics: [],
    nativeVersion: ts.version,
  };
}

/** Parses and compiles `files` from their contents. */
export async function compileTypeScript(
  input: AdapterCompileInput,
): Promise<NativeCompilationOutput> {
  const ts = await loadTypeScript();
  if (ts === undefined) {
    return {
      units: [],
      dependencies: {},
      failedFiles: [...input.files],
      diagnostics: [missingTypeScriptDiagnostic(input.languageId)],
    };
  }
  const entries: TypeScriptSourceEntry[] = [];
  for (const file of input.files) {
    const content = input.contents[file] ?? "";
    entries.push({
      file,
      hash: hashContent(content),
      sourceFile: ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFor(file, ts),
      ),
    });
  }
  return compileTypeScriptEntries(input, entries, ts);
}
