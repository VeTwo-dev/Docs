import { resolve, relative, dirname, basename, extname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import fg from "fast-glob";

/**
 * Resolves one or more path segments against a root directory.
 *
 * @param rootDir - The base directory.
 * @param segments - Path segments to append.
 * @returns The resolved absolute path.
 *
 * @example
 * ```ts
 * resolvePath("/project", "src", "docs");
 * // => "/project/src/docs"
 * ```
 */
export function resolvePath(rootDir: string, ...segments: string[]): string {
  return resolve(rootDir, ...segments);
}

/**
 * Computes the relative path from one absolute path to another.
 *
 * @param from - The source absolute path.
 * @param to - The target absolute path.
 * @returns The relative path string.
 *
 * @example
 * ```ts
 * relativePath("/a/b", "/a/b/c/d.txt");
 * // => "c/d.txt"
 * ```
 */
export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

/**
 * Creates a directory if it does not already exist (recursive).
 *
 * @param dirPath - The directory path to ensure exists.
 *
 * @example
 * ```ts
 * ensureDir("/tmp/output/nested");
 * ```
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writes content to a file, creating parent directories as needed.
 *
 * @param filePath - The absolute path to the output file.
 * @param content - The string content to write.
 *
 * @example
 * ```ts
 * writeFile("/tmp/out/index.html", "<h1>Hello</h1>");
 * ```
 */
export function writeFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Reads the entire contents of a file as a UTF-8 string.
 *
 * @param filePath - The absolute path to the file.
 * @returns The file contents.
 *
 * @example
 * ```ts
 * const content = readFile("/project/readme.md");
 * ```
 */
export function readFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

/**
 * Checks whether a file exists at the given path.
 *
 * @param filePath - The absolute path to check.
 * @returns `true` if the file exists.
 *
 * @example
 * ```ts
 * if (fileExists("/project/config.ts")) { ... }
 * ```
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Returns the size of a file in bytes.
 *
 * @param filePath - The absolute path to the file.
 * @returns The file size in bytes.
 */
export function getFileSize(filePath: string): number {
  return statSync(filePath).size;
}

/**
 * Returns the last modification time of a file.
 *
 * @param filePath - The absolute path to the file.
 * @returns A Date object representing the last modified time.
 */
export function getFileMtime(filePath: string): Date {
  return statSync(filePath).mtime;
}

/**
 * Extracts the file name without its extension.
 *
 * @param filePath - The file path.
 * @returns The base name without extension, e.g. `"index"` from `"/a/b/index.ts"`.
 */
export function getFileName(filePath: string): string {
  return basename(filePath, extname(filePath));
}

/**
 * Extracts the file extension from a path.
 *
 * @param filePath - The file path.
 * @returns The extension including the dot, e.g. `".ts"`.
 */
export function getFileExtension(filePath: string): string {
  return extname(filePath);
}

/**
 * Checks whether a file path points to a Markdown or MDX file.
 *
 * @param filePath - The file path.
 * @returns `true` if the extension is `.md` or `.mdx`.
 */
export function isMarkdown(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === ".md" || ext === ".mdx";
}

/**
 * Checks whether a file path points to an MDX file.
 *
 * @param filePath - The file path.
 * @returns `true` if the extension is `.mdx`.
 */
export function isMdx(filePath: string): boolean {
  return getFileExtension(filePath) === ".mdx";
}

/**
 * Globs files matching the given patterns inside a working directory.
 *
 * @param patterns - Glob patterns to match.
 * @param cwd - The working directory for the glob.
 * @returns A sorted list of matching file paths (relative to `cwd`).
 *
 * @example
 * ```ts
 * const files = await glob(["src/*.ts"], "/project");
 * ```
 */
export async function glob(patterns: readonly string[], cwd: string): Promise<readonly string[]> {
  return fg.glob([...patterns], { cwd, dot: true, onlyFiles: true });
}

/**
 * Finds files matching patterns, with support for ignore lists.
 *
 * @param patterns - Glob patterns to match.
 * @param cwd - The working directory for the glob.
 * @param ignore - Optional glob patterns to ignore.
 * @returns A sorted list of matching file paths.
 *
 * @example
 * ```ts
 * const files = await findFiles(["src/*.ts"], "/project", ["*.test.ts"]);
 * ```
 */
export async function findFiles(
  patterns: readonly string[],
  cwd: string,
  ignore: readonly string[] = [],
): Promise<readonly string[]> {
  const results = await fg.glob([...patterns], {
    cwd,
    dot: true,
    onlyFiles: true,
    ignore: [...ignore],
  });
  return results.sort();
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * @param text - The input text.
 * @returns A lowercased, hyphenated slug.
 *
 * @example
 * ```ts
 * slugify("Hello World!");
 * // => "hello-world"
 * ```
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Capitalises the first character of a string.
 *
 * @param text - The input text.
 * @returns The text with the first letter uppercased.
 *
 * @example
 * ```ts
 * capitalize("hello");
 * // => "Hello"
 * ```
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generates a unique document ID from a file path relative to the project root.
 *
 * @param filePath - The absolute file path.
 * @param rootDir - The project root directory.
 * @returns The generated ID, e.g. `"guides/getting-started"`.
 */
export function generateId(filePath: string, rootDir: string): string {
  const rel = relative(rootDir, filePath);
  const name = getFileName(rel);
  const dir = dirname(rel);
  return dir === "." ? name : `${dir}/${name}`;
}
