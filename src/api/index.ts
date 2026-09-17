/**
 * Semantic API Intelligence Layer.
 *
 * Top-level facade for analyzing, querying, and generating documentation
 * from a project's public API surface. Combines the TypeScript semantic
 * analyzer, JSDoc parser, type formatter, relationship graph, and page
 * generator into a single entry point.
 *
 * @example
 * ```ts
 * import { analyzeProjectAPIs } from "@vetwo/docs/api";
 *
 * const result = await analyzeProjectAPIs({
 *   rootDir: "/path/to/project",
 *   entryPoints: ["src/index.ts"],
 * });
 *
 * console.log(`Found ${result.symbols.length} API symbols`);
 * for (const sym of result.symbols) {
 *   console.log(`  ${sym.kind} ${sym.name} (${sym.sourceFile}:${sym.line})`);
 * }
 * ```
 */

import type { DocumentationArchitecture } from "../documentation/compiler/types.js";
import type { IRPage } from "../documentation/compiler/ir.js";
import { analyzeAPIs, type SemanticAnalyzerOptions } from "./analyzer.js";
import type { ApiSymbol, ApiAnalysisResult } from "./models.js";
import { buildApiGraph, type ApiGraph } from "./graph.js";
import { generateApiPages, type ApiPageGeneratorOptions } from "./page-generator.js";

export type { SemanticAnalyzerOptions } from "./analyzer.js";
export type { ApiPageGeneratorOptions } from "./page-generator.js";
export type {
  ApiSymbol,
  ApiSymbolKind,
  ApiParameter,
  ApiTypeParameter,
  ApiMember,
  ApiEnumMember,
  ApiDocComment,
  ApiAnalysisResult,
  ApiBoundary,
  ApiAccess,
} from "./models.js";
export type { ApiGraph, ApiEdge, ApiEdgeKind } from "./graph.js";
export * from "./diff.js";
export * from "./baseline.js";
export * from "./validate.js";
export * from "./incremental.js";
export * from "./monorepo.js";

/** The full result of analyzing a project's API surface. */
export interface ProjectApiAnalysis {
  /** All API symbols. */
  readonly symbols: readonly ApiSymbol[];
  /** The relationship graph. */
  readonly graph: ApiGraph;
  /** Rich IR pages generated from the symbols. */
  readonly pages: readonly IRPage[];
  /** The analysis result from the semantic analyzer. */
  readonly analysis: ApiAnalysisResult;
}

/**
 * Analyze a project's API surface and generate rich documentation pages.
 *
 * This is the primary entry point for the API intelligence layer. It:
 * 1. Runs the TypeScript semantic analyzer to extract API symbols
 * 2. Builds the relationship graph
 * 3. Generates rich IR pages with per-symbol documentation
 *
 * @param options - Analysis options (rootDir, entryPoints, tsconfig, etc.)
 * @param architecture - The documentation architecture (for page routing).
 * @param pageOptions - Options for page generation.
 * @returns The full project API analysis.
 *
 * @example
 * ```ts
 * const result = await analyzeProjectAPIs({
 *   rootDir: process.cwd(),
 *   entryPoints: ["src/index.ts"],
 *   exclude: ["test.ts", "spec.ts"],
 * }, architecture);
 *
 * // result.symbols — all API symbols
 * // result.graph — relationship graph
 * // result.pages — rich IR pages for the documentation
 * ```
 */
export async function analyzeProjectAPIs(
  options: SemanticAnalyzerOptions,
  architecture?: DocumentationArchitecture,
  pageOptions?: ApiPageGeneratorOptions,
): Promise<ProjectApiAnalysis> {
  // Step 1: Semantic analysis
  const analysis = await analyzeAPIs(options);

  // Step 2: Build relationship graph
  const graph = buildApiGraph(analysis.symbols);

  // Step 3: Generate pages (if architecture provided)
  const pages =
    architecture !== undefined
      ? generateApiPages(architecture, analysis.symbols, graph, pageOptions)
      : [];

  return {
    symbols: analysis.symbols,
    graph,
    pages,
    analysis,
  };
}

/**
 * Map API symbols to the legacy `CompilerProjectInput.apis` format.
 * Used for backward compatibility with the documentation compiler.
 *
 * @param symbols - API symbols from the semantic analyzer.
 * @returns Array compatible with the `apis` field.
 */
export function toCompilerApis(
  symbols: readonly ApiSymbol[],
): readonly {
  readonly name: string;
  readonly kind: string;
  readonly signature?: string;
  readonly description?: string;
  readonly sourceFile?: string;
  readonly boundary?: string;
  readonly deprecated?: boolean;
  readonly deprecatedInFavorOf?: string;
}[] {
  return symbols
    .filter((s) => s.exported && s.boundary !== "private")
    .map((s) => ({
      name: s.name,
      kind: s.kind,
      signature: s.returnType,
      description: s.documentation.summary,
      sourceFile: s.sourceFile,
      boundary: s.boundary,
      deprecated: s.deprecated !== false,
      ...(typeof s.deprecated === "string" ? { deprecatedInFavorOf: undefined } : {}),
    }));
}

/**
 * Get a summary of the API surface.
 *
 * @param symbols - API symbols from the semantic analyzer.
 * @returns A human-readable summary.
 */
export function summarizeApiSurface(symbols: readonly ApiSymbol[]): {
  readonly totalSymbols: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly exported: number;
  readonly deprecated: number;
  readonly withDocumentation: number;
  readonly files: readonly string[];
} {
  const byKind: Record<string, number> = {};
  let exported = 0;
  let deprecated = 0;
  let withDocumentation = 0;
  const files = new Set<string>();

  for (const sym of symbols) {
    byKind[sym.kind] = (byKind[sym.kind] ?? 0) + 1;
    if (sym.exported) exported++;
    if (sym.deprecated !== false) deprecated++;
    if (sym.documentation.summary.length > 0) withDocumentation++;
    files.add(sym.sourceFile);
  }

  return {
    totalSymbols: symbols.length,
    byKind,
    exported,
    deprecated,
    withDocumentation,
    files: [...files].sort(),
  };
}
