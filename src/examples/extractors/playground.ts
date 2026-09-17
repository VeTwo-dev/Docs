import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols, detectPackages } from "../normalizers/normalizer.js";

/** Directories treated as project play areas. */
export const PLAYGROUND_DIRS = ["playground", "demo", "sandbox", "scratch", "demos"] as const;

/** Whether a relative path lives inside a play area. */
export function isPlaygroundPath(path: string): boolean {
  const segments = path.split("/");
  return segments.some((segment) => (PLAYGROUND_DIRS as readonly string[]).includes(segment));
}

/** Source file extensions scanned inside play areas. */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
];

/**
 * Extracts demo examples from project play areas (`playground/`, `demo/`,
 * `sandbox/`). Playground files are classified separately from production
 * examples so their provenance is never ambiguous.
 */
export function createPlaygroundExampleExtractor(): ExampleExtractor {
  return {
    id: "playground",
    name: "Playground example extractor",
    provenanceKinds: ["playground"],

    supports(path: string): boolean {
      if (!isPlaygroundPath(path)) return false;
      const lower = path.toLowerCase();
      return SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const body = normalizeExampleBody(input.content);
      if (body.trim().length === 0) return Object.freeze([]);
      return Object.freeze([
        {
          title: `Playground example from ${input.path}`,
          language: languageFor(input.path),
          content: body,
          provenance: provenance("playground", input.path),
          description: "Interactive demo found in a project play area",
          typeHint: "demo",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.8,
        },
      ]);
    },
  };
}

function languageFor(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts") || path.endsWith(".mts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "js";
  if (path.endsWith(".vue")) return "vue";
  if (path.endsWith(".svelte")) return "svelte";
  return "text";
}
