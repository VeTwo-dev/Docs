import type { FileCategory } from "../types/categories.js";
import { detectEncoding, detectLanguage } from "../utils/extensions.js";
import { getExtension } from "../utils/path.js";
import { classifyAssetFile } from "./asset-classifier.js";
import type { FileClassification, FileClassificationInput, FileClassifier } from "./types.js";

/** Extensions that mark a file as source code. */
export const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".kts",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".scala",
  ".dart",
  ".lua",
  ".r",
  ".d",
  ".ex",
  ".exs",
  ".clj",
  ".cljs",
  ".elm",
  ".hs",
  ".nim",
  ".zig",
  ".vue",
  ".svelte",
  ".astro",
  ".sql",
  ".graphql",
  ".gql",
  ".html",
  ".htm",
  ".proto",
  ".tex",
]);

/** Extensions that mark a file as a shell/build script. */
export const SCRIPT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".bat",
  ".cmd",
]);

/** Extensions that mark a file as stylesheet. */
export const STYLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
]);

/** Extensions that mark a file as documentation. */
export const DOCUMENTATION_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md",
  ".mdx",
  ".markdown",
  ".rst",
]);

/** Extensions that mark a file as configuration data. */
export const CONFIG_EXTENSIONS: ReadonlySet<string> = new Set([
  ".json",
  ".jsonc",
  ".json5",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
]);

/** Extension-only generated markers (source maps, incremental caches). */
const GENERATED_EXTENSIONS: ReadonlySet<string> = new Set([".map", ".tsbuildinfo"]);

/** File names treated as scripts regardless of extension. */
const SCRIPT_FILE_NAMES: ReadonlySet<string> = new Set([
  "makefile",
  "gnumakefile",
  "justfile",
  "procfile",
  "gemfile",
  "rakefile",
  "dockerfile",
]);

/** Documentation file names recognised regardless of extension. */
const DOCUMENTATION_FILE_NAMES: ReadonlySet<string> = new Set([
  "readme",
  "changelog",
  "changes",
  "contributing",
  "code_of_conduct",
  "security",
  "authors",
  "notice",
  "about",
  "license",
  "licence",
  "copying",
]);

/** Cache file names/extensions. */
const CACHE_FILE_NAMES: ReadonlySet<string> = new Set([
  ".eslintcache",
  ".stylelintcache",
  ".babelcache",
  ".cache",
  "yarn-error.log",
  "npm-debug.log",
]);

/** Temporary file extensions. */
const TEMPORARY_EXTENSIONS: ReadonlySet<string> = new Set([
  ".tmp",
  ".temp",
  ".swp",
  ".swo",
  ".bak",
  ".orig",
  ".rej",
  ".part",
]);

const TEST_NAME_PATTERN =
  /\.(test|spec|e2e|integration|int)\.|\.(test|spec|e2e|integration|int)[-_]/;
const STORY_NAME_PATTERN = /\.(stories|story)\./;
const BENCH_NAME_PATTERN = /\.(bench|benchmark)\./;

/** Detects whether a name includes a test/spec/e2e marker. */
export function hasTestMarker(name: string): boolean {
  return TEST_NAME_PATTERN.test(name);
}

/** Detects whether a name includes a story marker. */
export function hasStoryMarker(name: string): boolean {
  return STORY_NAME_PATTERN.test(name);
}

/** Detects whether a name includes a benchmark marker. */
export function hasBenchmarkMarker(name: string): boolean {
  return BENCH_NAME_PATTERN.test(name);
}

/** Detects directory-based test/story/benchmark locations. */
function directoryMarker(relativePath: string): FileCategory | null {
  const segments = relativePath.split("/");
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (
      lower === "__tests__" ||
      lower === "__specs__" ||
      lower === "__mocks__" ||
      lower === "e2e"
    ) {
      return "test";
    }
    if (lower === "__snapshots__") return "snapshot";
    if (lower === "stories" || lower === "__stories__" || lower === "storybook") return "story";
    if (lower === "benchmarks" || lower === "bench") return "benchmark";
  }
  return null;
}

/** Detects documentation file names (e.g. README, LICENSE). */
export function isDocumentationName(name: string): boolean {
  const stem = name.replace(/\.(md|mdx|markdown|rst|txt)$/i, "").toLowerCase();
  return DOCUMENTATION_FILE_NAMES.has(stem);
}

/** The built-in file classifier. */
export const fileClassifier: FileClassifier = (input) => classifyFile(input);

/**
 * Classifies a file into a category, language and generated flag.
 *
 * @param input - The file to classify.
 * @returns The file classification.
 */
export function classifyFile(input: FileClassificationInput): FileClassification {
  const extension = getExtension(input.relativePath);
  const name = input.name;
  const lowerName = name.toLowerCase();

  const generated = isGeneratedFile(name, extension);
  if (extension === ".map") {
    return { category: "generated", language: "unknown", generated: true };
  }
  if (extension === ".tsbuildinfo") {
    return { category: "cache", language: "json", generated: false };
  }
  if (extension === ".snap" || name.endsWith(".snap")) {
    return { category: "snapshot", language: detectLanguage(extension), generated: false };
  }

  const directoryCategory = directoryMarker(input.relativePath);
  if (hasTestMarker(name) || directoryCategory === "test") {
    return { category: "test", language: detectLanguage(extension), generated: false };
  }
  if (hasStoryMarker(name) || directoryCategory === "story") {
    return { category: "story", language: detectLanguage(extension), generated: false };
  }
  if (hasBenchmarkMarker(name) || directoryCategory === "benchmark") {
    return { category: "benchmark", language: detectLanguage(extension), generated: false };
  }
  if (directoryCategory === "snapshot") {
    return { category: "snapshot", language: detectLanguage(extension), generated: false };
  }

  if (DOCUMENTATION_EXTENSIONS.has(extension) || isDocumentationName(name)) {
    return { category: "documentation", language: detectLanguage(extension), generated: false };
  }

  if (SCRIPT_FILE_NAMES.has(lowerName)) {
    return { category: "script", language: detectLanguage(extension), generated: false };
  }

  if (isConfigFileName(name) || CONFIG_EXTENSIONS.has(extension)) {
    return { category: "config", language: detectLanguage(extension), generated: false };
  }

  if (name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".d.cts")) {
    return { category: "declaration", language: "typescript", generated: false };
  }

  if (SCRIPT_EXTENSIONS.has(extension)) {
    return { category: "script", language: detectLanguage(extension), generated: false };
  }

  if (STYLE_EXTENSIONS.has(extension)) {
    return { category: "style", language: detectLanguage(extension), generated: false };
  }

  const assetType = classifyAssetFile(input);
  if (assetType !== null) {
    return { category: "asset", language: "unknown", generated: false };
  }

  if (SOURCE_EXTENSIONS.has(extension)) {
    return { category: "source", language: detectLanguage(extension), generated };
  }

  if (
    extension === ".txt" ||
    extension === ".csv" ||
    extension === ".xml" ||
    extension === ".rss" ||
    extension === ".atom" ||
    extension === ".ics"
  ) {
    return { category: "asset", language: detectLanguage(extension), generated: false };
  }

  if (CACHE_FILE_NAMES.has(lowerName)) {
    return { category: "cache", language: "unknown", generated: false };
  }

  if (TEMPORARY_EXTENSIONS.has(extension)) {
    return { category: "temporary", language: "unknown", generated: false };
  }

  return { category: "unknown", language: detectLanguage(extension), generated };
}

/** Well-known dotfile configuration base names (extension variants match too). */
const CONFIG_DOTFILE_BASES: ReadonlySet<string> = new Set([
  ".npmrc",
  ".yarnrc",
  ".babelrc",
  ".swcrc",
  ".eslintrc",
  ".prettierrc",
  ".gitignore",
  ".npmignore",
  ".docsignore",
  ".dockerignore",
  ".editorconfig",
  ".gitattributes",
  ".gitmodules",
  ".nvmrc",
  ".node-version",
  ".tool-versions",
  ".netrc",
  ".envrc",
  ".renovaterc",
]);

/** Whether a file name denotes a configuration file. */
export function isConfigFileName(name: string): boolean {
  if (name.startsWith(".env")) return true;
  const lower = name.toLowerCase();
  if (lower === ".gitkeep") return false;
  const stem = lower.replace(/\.(json|jsonc|js|cjs|mjs|yaml|yml|toml)$/i, "");
  return CONFIG_DOTFILE_BASES.has(stem) || CONFIG_DOTFILE_BASES.has(lower);
}

/** Whether a file is considered generated output. */
export function isGeneratedFile(name: string, extension: string): boolean {
  if (GENERATED_EXTENSIONS.has(extension)) return true;
  return /\.min\.(js|css)$/.test(name) || /\.bundle\.(js|css)$/.test(name);
}

/** Computes a text/binary encoding hint for a file. */
export function fileEncoding(input: FileClassificationInput): "utf8" | "binary" {
  return detectEncoding(getExtension(input.relativePath));
}
