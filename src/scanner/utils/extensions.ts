/** Mapping of file extension (including dot) to a language name. */
export const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "jsx",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".scala": "scala",
  ".dart": "dart",
  ".lua": "lua",
  ".r": "r",
  ".d": "d",
  ".ex": "elixir",
  ".exs": "elixir",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".elm": "elm",
  ".hs": "haskell",
  ".nim": "nim",
  ".zig": "zig",
  ".vue": "vue",
  ".svelte": "svelte",
  ".astro": "astro",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ps1": "powershell",
  ".bat": "batch",
  ".cmd": "batch",
  ".md": "markdown",
  ".mdx": "mdx",
  ".markdown": "markdown",
  ".rst": "restructuredtext",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".styl": "stylus",
  ".json": "json",
  ".jsonc": "jsonc",
  ".json5": "json5",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".ini": "ini",
  ".xml": "xml",
  ".svg": "svg",
  ".dockerfile": "dockerfile",
  ".tex": "latex",
  ".proto": "protobuf",
};

/** File extensions that are treated as plain text for encoding detection. */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ...Object.keys(LANGUAGE_BY_EXTENSION),
  ".txt",
  ".gitignore",
  ".npmignore",
  ".editorconfig",
  ".env",
  ".env.example",
  ".gitattributes",
  ".nvmrc",
  ".node-version",
  ".tool-versions",
  ".dockerignore",
  ".slugignore",
  ".gitkeep",
]);

/** Mapping of file extension to a MIME type. */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/plain",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".7z": "application/x-7z-compressed",
  ".wasm": "application/wasm",
};

/** Detects the language of a file by extension. */
export function detectLanguage(extension: string): string {
  return LANGUAGE_BY_EXTENSION[extension.toLowerCase()] ?? "unknown";
}

/** Detects the MIME type of a file by extension. */
export function detectMimeType(extension: string): string | undefined {
  return MIME_BY_EXTENSION[extension.toLowerCase()];
}

/** Whether a file extension is considered plain text. */
export function isTextExtension(extension: string): boolean {
  return TEXT_EXTENSIONS.has(extension.toLowerCase());
}

/** Detects the encoding of a file based on its extension. */
export function detectEncoding(extension: string): "utf8" | "binary" {
  return isTextExtension(extension) ? "utf8" : "binary";
}
