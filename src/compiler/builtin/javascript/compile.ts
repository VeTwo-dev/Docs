import type { AdapterCompileInput, NativeCompilationOutput } from "../../contracts/adapter.js";
import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
  type CompilerRange,
} from "../../contracts/diagnostics.js";
import { normalizeCompilerDiagnostic } from "../../diagnostics/normalize.js";
import { createCompilationUnit } from "../../models/unit.js";
import { resolveSpecifiers } from "../../shared/dependencies.js";
import { hashContent } from "../../shared/hash.js";
import { nowMs } from "../../shared/time.js";
import { limitsFromOptions } from "../../shared/tree.js";
import { extractBabelModuleSpecifiers } from "./dependencies.js";
import { BABEL_PLUGINS, JAVASCRIPT_EXTENSIONS, loadBabelParser } from "./native.js";
import { buildBabelTree } from "./tree.js";

/** Compiler-level diagnostic when the Babel parser cannot be loaded. */
export function missingBabelDiagnostic(languageId: string): CompilerDiagnostic {
  return createCompilerDiagnostic({
    code: CompilerDiagnosticCode.MissingCompiler,
    severity: "error",
    message: `The "@babel/parser" compiler is not available. Install the "@babel/parser" package.`,
    compilerId: "javascript",
    languageId,
  });
}

interface BabelError extends Error {
  readonly code?: unknown;
  readonly reasonCode?: unknown;
  readonly pos?: unknown;
  readonly loc?: { readonly line?: unknown; readonly column?: unknown; readonly index?: unknown };
}

/** Builds a normalized range from a Babel error's location. */
function babelErrorRange(error: BabelError): CompilerRange | undefined {
  const line = error.loc?.line;
  const column = error.loc?.column;
  if (typeof line !== "number" || typeof column !== "number") return undefined;
  return Object.freeze({
    start: Object.freeze({
      line,
      column: column + 1,
      ...(typeof error.pos === "number" ? { offset: error.pos } : {}),
    }),
    end: Object.freeze({
      line,
      column: column + 1,
      ...(typeof error.pos === "number" ? { offset: error.pos + 1 } : {}),
    }),
  });
}

/** Parses and compiles `files` from their contents. */
export async function compileJavaScript(
  input: AdapterCompileInput,
): Promise<NativeCompilationOutput> {
  const parser = await loadBabelParser();
  if (parser === undefined || parser.parse === undefined) {
    return {
      units: [],
      dependencies: {},
      failedFiles: [...input.files],
      diagnostics: [missingBabelDiagnostic(input.languageId)],
    };
  }
  const limits = limitsFromOptions(input.options);
  const knownFiles = new Set(input.files);
  const units = [];
  const dependencies: Record<string, readonly string[]> = {};
  const failedFiles: string[] = [];
  const context = { compilerId: "javascript", languageId: input.languageId };

  for (const file of input.files) {
    const fileStarted = nowMs();
    const content = input.contents[file] ?? "";
    const diagnostics: CompilerDiagnostic[] = [];
    let status: "ok" | "failed" = "ok";
    let tree;
    let nativeBody: readonly unknown[] = [];
    try {
      const ast = parser.parse(content, {
        sourceType: "module",
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        plugins: BABEL_PLUGINS,
      });
      nativeBody = ast["program"]["body"] as readonly unknown[];
      tree = buildBabelTree(ast, limits);
      for (const error of ast.errors) {
        const diagnostic = normalizeCompilerDiagnostic(error, {
          ...context,
          defaultFile: file,
        });
        if (diagnostic !== null) diagnostics.push(diagnostic);
      }
    } catch (error) {
      const babelError = error as BabelError;
      const diagnostic = normalizeCompilerDiagnostic(
        {
          message: babelError.message ?? String(babelError),
          code: babelError.code,
          reasonCode: babelError.reasonCode,
          loc: babelError.loc,
          pos: babelError.pos,
          range: babelErrorRange(babelError),
        },
        { ...context, defaultFile: file },
      );
      if (diagnostic !== null) diagnostics.push(diagnostic);
      status = "failed";
    }
    if (status === "failed" || diagnostics.some((d) => d.severity === "error")) {
      status = "failed";
      failedFiles.push(file);
    }
    dependencies[file] = resolveSpecifiers(
      input.rootDir,
      file,
      extractBabelModuleSpecifiers(nativeBody),
      [...JAVASCRIPT_EXTENSIONS, ".ts", ".tsx", ".mts", ".cts"],
      knownFiles,
    );
    units.push(
      createCompilationUnit({
        file,
        languageId: input.languageId,
        compilerId: "javascript",
        status,
        ...(tree !== undefined ? { syntaxTree: tree } : {}),
        diagnostics,
        hash: hashContent(content),
        compileTimeMs: nowMs() - fileStarted,
      }),
    );
  }

  return {
    units,
    dependencies,
    failedFiles,
    diagnostics: [],
  };
}
