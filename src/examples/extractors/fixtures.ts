import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols, detectPackages } from "../normalizers/normalizer.js";

/** Fixture directory conventions. */
export const FIXTURE_DIR_NAMES = [
  "__fixtures__",
  "fixtures",
  "fixture",
  "__snapshots__",
  "testdata",
] as const;

/** Whether a relative path lives inside a fixture directory. */
export function isFixturePath(path: string): boolean {
  const segments = path.split("/");
  return segments.some((segment) => (FIXTURE_DIR_NAMES as readonly string[]).includes(segment));
}

/** File extensions scanned inside fixture directories. */
const FIXTURE_EXTENSIONS = [
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".yaml",
  ".yml",
  ".toml",
  ".md",
];

/**
 * Extracts fixture examples from `__fixtures__`, `fixtures/`, `testdata/`
 * directories. Fixture provenance is explicit so the engine never presents
 * fixtures as production usage.
 */
export function createFixtureExampleExtractor(): ExampleExtractor {
  return {
    id: "fixtures",
    name: "Fixture extractor",
    provenanceKinds: ["fixtures"],

    supports(path: string): boolean {
      if (!isFixturePath(path)) return false;
      const lower = path.toLowerCase();
      return FIXTURE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const body = normalizeExampleBody(input.content);
      if (body.trim().length === 0) return Object.freeze([]);
      return Object.freeze([
        {
          title: `Fixture from ${input.path}`,
          language: languageFor(input.path),
          content: body,
          provenance: provenance("fixtures", input.path),
          description: "Test fixture data",
          typeHint: "fixture",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.85,
        },
      ]);
    },
  };
}

function languageFor(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}
