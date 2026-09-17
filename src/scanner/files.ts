import type { SourceFile } from "../types/public.js";
import { findFiles, getFileExtension, getFileMtime } from "../filesystem/index.js";
import {
  MARKDOWN_EXTENSIONS,
  SOURCE_EXTENSIONS,
  DEFAULT_IGNORE_PATTERNS,
} from "../constants/defaults.js";
import { relative, resolve } from "node:path";

const ALL_DOC_EXTENSIONS = [...MARKDOWN_EXTENSIONS];
const ALL_SOURCE_EXTENSIONS = [...SOURCE_EXTENSIONS];

/**
 * Discovers Markdown/MDX documentation files in the source directory.
 *
 * @param rootDir - The project root directory.
 * @param sourceDir - The documentation source directory to search.
 * @param ignore - Additional glob patterns to ignore.
 * @returns A sorted array of discovered source file metadata.
 *
 * @example
 * ```ts
 * const files = await discoverDocFiles("/project", "./docs", ["node_modules"]);
 * ```
 */
export async function discoverDocFiles(
  rootDir: string,
  sourceDir: string,
  ignore: readonly string[] = [],
): Promise<readonly SourceFile[]> {
  const patterns = ALL_DOC_EXTENSIONS.map((ext) => `**/*${ext}`);
  const combinedIgnore = [...DEFAULT_IGNORE_PATTERNS, ...ignore];
  const files = await findFiles(patterns, sourceDir, combinedIgnore);

  return files.map((file) => {
    const absolutePath = resolve(sourceDir, file);
    return {
      path: absolutePath,
      relativePath: relative(rootDir, absolutePath),
      extension: getFileExtension(absolutePath),
      size: 0,
      lastModified: getFileMtime(absolutePath),
    };
  });
}

/**
 * Discovers source code files (TypeScript, JavaScript, etc.) suitable for API documentation extraction.
 *
 * @param rootDir - The project root directory.
 * @param sourceDir - The source code directory to search.
 * @param ignore - Additional glob patterns to ignore.
 * @returns A sorted array of discovered source file metadata.
 *
 * @example
 * ```ts
 * const files = await discoverSourceFiles("/project", "./src", ["*.test.*"]);
 * ```
 */
export async function discoverSourceFiles(
  rootDir: string,
  sourceDir: string,
  ignore: readonly string[] = [],
): Promise<readonly SourceFile[]> {
  const patterns = ALL_SOURCE_EXTENSIONS.map((ext) => `**/*${ext}`);
  const combinedIgnore = [
    ...DEFAULT_IGNORE_PATTERNS,
    "**/*.test.*",
    "**/*.spec.*",
    "**/*.d.ts",
    ...ignore,
  ];
  const files = await findFiles(patterns, sourceDir, combinedIgnore);

  return files.map((file) => {
    const absolutePath = resolve(sourceDir, file);
    return {
      path: absolutePath,
      relativePath: relative(rootDir, absolutePath),
      extension: getFileExtension(absolutePath),
      size: 0,
      lastModified: getFileMtime(absolutePath),
    };
  });
}
