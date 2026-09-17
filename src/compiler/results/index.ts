import type { CompilerDiagnostic } from "../contracts/diagnostics.js";
import type { CompilerPosition, CompilerRange } from "../contracts/diagnostics.js";
import type { CompilerRequestOptions } from "../contracts/request.js";

export type { CompilerPosition, CompilerRange };

/**
 * Universal compilation result models.
 *
 * Every compiler adapter produces these shapes; the engine consumes nothing
 * else. All models are immutable and frozen by their `create*` constructors
 * in `../models/`.
 */

/** A node of the normalized syntax tree. */
export interface SyntaxNode {
  /** Coarse normalized kind (e.g. `FunctionDeclaration`, `statement`). */
  readonly kind: string;
  /** The identifier name, when the node declares one. */
  readonly name?: string;
  /** The node's source range, when known. */
  readonly range?: CompilerRange;
  /** Child nodes (bounded by the request's depth/node caps). */
  readonly children?: readonly SyntaxNode[];
  /** Opaque native node handle. Never inspected by the engine. */
  readonly raw?: unknown;
  /** Modifier keywords and structural flags (e.g. `export`, `default`, `static`, `const`, `async`). */
  readonly modifiers?: readonly string[];
  /** Raw documentation comment attached to the declaration (TSDoc/JSDoc text, tags included). */
  readonly documentation?: string;
  /** Decorator expressions, when present (e.g. `Component`, `Component({ ... })`). */
  readonly decorators?: readonly string[];
  /** Generic type parameter names, when present. */
  readonly typeParameters?: readonly string[];
  /** Module specifier for import/export declarations. */
  readonly moduleSpecifier?: string;
  /** The local name of an export/import specifier (`b` in `export { a as b }`). */
  readonly propertyName?: string;
}

/**
 * A normalized syntax tree.
 *
 * Language-specific detail is collapsed to `kind`/`name`/`range` + children;
 * the native node remains reachable only as an opaque `raw` handle.
 */
export interface SyntaxTree {
  /** The language the tree was parsed as. */
  readonly languageId: string;
  /** The relative file the tree describes. */
  readonly file: string;
  /** The syntax format (e.g. `typescript`, `ecmascript`). */
  readonly format: string;
  /** The tree root node. */
  readonly root: SyntaxNode;
  /** The total number of normalized nodes. */
  readonly nodeCount: number;
  /** Whether node/depth caps truncated the normalization. */
  readonly truncated: boolean;
  /** Opaque native identity (compiler + version). */
  readonly native?: { readonly name: string; readonly version?: string };
}

/** A normalized source map (version 3). */
export interface SourceMap {
  readonly version: 3;
  readonly file?: string;
  readonly sourceRoot?: string;
  readonly sources: readonly string[];
  readonly sourcesContent?: readonly (string | null)[];
  readonly names: readonly string[];
  /** Base64-VLQ encoded mappings. */
  readonly mappings: string;
}

/** The outcome of compiling one file. */
export interface CompilationUnit {
  /** The relative file path. */
  readonly file: string;
  /** The language adapter id. */
  readonly languageId: string;
  /** The compiler adapter id. */
  readonly compilerId: string;
  readonly status: "ok" | "failed" | "skipped";
  /** The normalized syntax tree, when parsing succeeded. */
  readonly syntaxTree?: SyntaxTree;
  /** Normalized diagnostics for this unit. */
  readonly diagnostics: readonly CompilerDiagnostic[];
  /** A source map, when requested and supported. */
  readonly sourceMap?: SourceMap;
  /** Content hash the unit was compiled from. */
  readonly hash: string;
  /** Time spent compiling this unit (ms). */
  readonly compileTimeMs: number;
}

/** Timing and aggregate counters for a compilation request. */
export interface CompilationStatistics {
  /** Total requested files. */
  readonly totalFiles: number;
  /** Files actually compiled (ok + failed). */
  readonly compiledFiles: number;
  /** Files skipped because they were unchanged. */
  readonly skippedFiles: number;
  /** Files served from the compiler cache. */
  readonly cachedFiles: number;
  /** Files that failed to compile. */
  readonly failedFiles: number;
  /** Total wall-clock time for the request (ms). */
  readonly totalTimeMs: number;
  /** Sum of per-unit compile times (ms). */
  readonly compileTimeMs: number;
  /** Total normalized syntax nodes produced. */
  readonly treeNodes: number;
  /** Whether every requested file was served from cache. */
  readonly cached: boolean;
  /** The native compiler version, when known. */
  readonly nativeVersion?: string;
}

/** Static context captured for a compilation request. */
export interface CompilationContext {
  /** The caller-supplied (or generated) request id. */
  readonly requestId: string;
  /** The project root directory. */
  readonly rootDir: string;
  /** The compiled language. */
  readonly languageId: string;
  /** The compiler used. */
  readonly compilerId: string;
  /** The requested relative files. */
  readonly files: readonly string[];
  /** The files actually compiled. */
  readonly compiledFiles: readonly string[];
  /** `full` or `incremental` compile mode. */
  readonly mode: "full" | "incremental";
  /** Workspace context, when known. */
  readonly workspace?: {
    readonly manager?: string;
    readonly packages?: readonly string[];
    readonly monorepo: boolean;
  };
  /** The compiler options used. */
  readonly options: CompilerRequestOptions;
}

/**
 * The universal compilation result — the single output of the compiler layer.
 */
export interface CompilationResult {
  readonly requestId: string;
  readonly compilerId: string;
  readonly languageId: string;
  readonly rootDir: string;
  /** One unit per requested file (compiled, cached or skipped). */
  readonly units: readonly CompilationUnit[];
  /** Relative paths of files that failed to compile. */
  readonly failedFiles: readonly string[];
  /** Relative paths served from the cache (unchanged files). */
  readonly cachedFiles: readonly string[];
  /** Relative paths skipped entirely. */
  readonly skippedFiles: readonly string[];
  /** Relative paths added, modified or renamed this request. */
  readonly changedFiles: readonly string[];
  /** Relative paths removed since the previous request. */
  readonly removedFiles: readonly string[];
  /** File → resolved relative dependencies (syntactic). */
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  /** Compiler-level normalized diagnostics. */
  readonly diagnostics: readonly CompilerDiagnostic[];
  /** Aggregate counters. */
  readonly statistics: CompilationStatistics;
  /** Static request context. */
  readonly context: CompilationContext;
  /** Epoch ms timestamp. */
  readonly timestamp: number;
  /** Whether the request completed without error diagnostics. */
  readonly ok: boolean;
}
