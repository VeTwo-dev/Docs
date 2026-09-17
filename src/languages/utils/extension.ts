import { basename } from "node:path";

/** Common code-language MIME types. */
export const CODE_MIME_TYPES: Readonly<Record<string, string>> = {
  ".ts": "application/typescript",
  ".tsx": "application/typescript",
  ".mts": "application/typescript",
  ".cts": "application/typescript",
  ".js": "application/javascript",
  ".jsx": "application/javascript",
  ".mjs": "application/javascript",
  ".cjs": "application/javascript",
  ".json": "application/json",
  ".py": "text/x-python",
  ".rs": "text/rust",
  ".go": "text/x-go",
  ".java": "text/x-java-source",
  ".rb": "text/x-ruby",
  ".php": "text/x-php",
  ".swift": "text/x-swift",
  ".c": "text/x-c",
  ".h": "text/x-c",
  ".cpp": "text/x-c++src",
  ".cs": "text/x-csharp",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".scss": "text/x-scss",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/plain",
  ".xml": "text/xml",
};

/** Normalises an extension: ensures a leading dot and lowercases it. */
export function normalizeExtension(extension: string): string {
  let normalized = extension.trim().toLowerCase();
  if (normalized && !normalized.startsWith(".")) normalized = `.${normalized}`;
  return normalized;
}

/** Extracts the extension (including dot) from a file name or path. */
export function extensionOf(fileName: string): string {
  const base = basename(fileName);
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index) : "";
}

/** The MIME type for a code extension, falling back to `text/plain`. */
export function mimeOfExtension(extension: string): string {
  return CODE_MIME_TYPES[normalizeExtension(extension)] ?? "text/plain";
}

/** Case-insensitive extension match against a list of candidates. */
export function matchesExtension(extension: string, candidates: readonly string[]): boolean {
  const normalized = normalizeExtension(extension);
  return candidates.some((candidate) => normalizeExtension(candidate) === normalized);
}

/** The basename of a path, in POSIX or platform form. */
export function fileNameOf(path: string): string {
  return basename(path);
}
