import type * as ts from "typescript";
import type { CompilerRequestOptions } from "../../contracts/request.js";
import type { SourceMap } from "../../results/index.js";
import { createSourceMap } from "../../models/sourcemap.js";
import type { TypeScriptModule } from "./native.js";

/**
 * Generates a normalized source map for a file via the TypeScript
 * `transpileModule` emit path. Returns `undefined` when the compiler cannot
 * produce a map for the file.
 */
export function transpileSourceMap(
  content: string,
  file: string,
  options: CompilerRequestOptions | undefined,
  ts: TypeScriptModule,
): SourceMap | undefined {
  const config = { ...(options?.config ?? {}) } as ts.CompilerOptions;
  const compilerOptions: ts.CompilerOptions = {
    sourceMap: true,
    inlineSourceMap: false,
    ...config,
  };
  if (file.endsWith(".tsx") && compilerOptions.jsx === undefined) {
    compilerOptions.jsx = ts.JsxEmit.Preserve;
  }
  const result = ts.transpileModule(content, { compilerOptions, fileName: file });
  if (result.sourceMapText === undefined) return undefined;
  try {
    const parsed = JSON.parse(result.sourceMapText) as {
      file?: string;
      sourceRoot?: string;
      sources?: readonly string[];
      sourcesContent?: readonly (string | null)[];
      names?: readonly string[];
      mappings?: string;
    };
    return createSourceMap({
      file: parsed.file,
      sourceRoot: parsed.sourceRoot,
      sources: relativizeSources(parsed.sources ?? [], file),
      sourcesContent: parsed.sourcesContent,
      names: parsed.names ?? [],
      mappings: parsed.mappings ?? "",
    });
  } catch {
    return undefined;
  }
}

function relativizeSources(sources: readonly string[], file: string): readonly string[] {
  const base = file.slice(file.lastIndexOf("/") + 1);
  return sources.map((source) => (source === base ? file : source));
}
