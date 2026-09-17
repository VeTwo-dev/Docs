import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols, detectPackages } from "../normalizers/normalizer.js";

/** Directory names treated as dedicated example areas. */
export const EXAMPLE_DIR_NAMES = ["examples", "example", "demos", "samples"] as const;

/** Whether a relative path lives inside a dedicated example directory. */
export function isExamplesPath(path: string): boolean {
  const segments = path.split("/");
  return segments.some((segment) => (EXAMPLE_DIR_NAMES as readonly string[]).includes(segment));
}

/** File extensions scanned inside example directories. */
const EXAMPLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".md",
  ".mdx",
  ".html",
  ".vue",
  ".svelte",
];

/**
 * Extracts examples from dedicated `examples/`-style directories. Files in
 * these directories are first-class example evidence: whole files, not just
 * fenced snippets.
 */
export function createExamplesDirectoryExampleExtractor(): ExampleExtractor {
  return {
    id: "examples-directory",
    name: "Examples directory extractor",
    provenanceKinds: ["examples"],

    supports(path: string): boolean {
      if (!isExamplesPath(path)) return false;
      const lower = path.toLowerCase();
      return EXAMPLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const body = normalizeExampleBody(input.content);
      if (body.trim().length === 0) return Object.freeze([]);
      return Object.freeze([
        {
          title: titleFor(input.path),
          language: languageFor(input.path),
          content: body,
          provenance: provenance("examples", input.path),
          description: "Example found in a dedicated examples directory",
          typeHint: "demo",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.9,
        },
      ]);
    },
  };
}

function titleFor(path: string): string {
  const name = path.split("/").pop() ?? path;
  return `Example: ${name}`;
}

function languageFor(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts") || path.endsWith(".mts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "js";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".mdx")) return "mdx";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".vue")) return "vue";
  if (path.endsWith(".svelte")) return "svelte";
  return "text";
}
