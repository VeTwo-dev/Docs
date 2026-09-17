import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectPackages } from "../normalizers/normalizer.js";

/** Config file conventions recognized by the extractor. */
const CONFIG_PATTERNS = [
  /^tsconfig(?:\.\w+)?\.json$/,
  /^jsconfig(?:\.\w+)?\.json$/,
  /^vite\.config\.\w+$/,
  /^webpack\.config\.\w+$/,
  /^rollup\.config\.\w+$/,
  /^esbuild\.config\.\w+$/,
  /^next\.config\.\w+$/,
  /^nuxt\.config\.\w+$/,
  /^astro\.config\.\w+$/,
  /^svelte\.config\.\w+$/,
  /^eslint\.config\.\w+$/,
  /^\.eslintrc/,
  /^prettier\.config\.\w+$/,
  /^\.prettierrc/,
  /^vitest\.config\.\w+$/,
  /^jest\.config\.\w+$/,
  /^tailwind\.config\.\w+$/,
  /^docs\.config\.\w+$/,
  /^biome\.json$/,
  /^\.env(\.\w+)?$/,
];

/** The set of supported configuration options, for validation. */
export const KNOWN_CONFIG_KEYS = [
  "extends",
  "compilerOptions",
  "include",
  "exclude",
  "plugins",
  "output",
  "source",
  "theme",
  "sidebar",
  "navigation",
  "strict",
  "target",
  "module",
  "test",
  "rules",
] as const;

/**
 * Extracts realistic configuration examples from config files, README
 * fenced blocks and fixture files. Records the configuration type and which
 * options the example demonstrates.
 */
export function createConfigurationExampleExtractor(): ExampleExtractor {
  return {
    id: "configuration",
    name: "Configuration example extractor",
    provenanceKinds: ["configuration"],

    supports(path: string): boolean {
      const name = path.split("/").pop() ?? path;
      return CONFIG_PATTERNS.some((pattern) => pattern.test(name));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const body = normalizeExampleBody(input.content);
      if (body.trim().length === 0) return Object.freeze([]);
      return Object.freeze([
        {
          title: `Configuration example from ${input.path}`,
          language: languageFor(input.path),
          content: body,
          provenance: provenance("configuration", input.path),
          description: `Configuration file demonstrating: ${detectKeys(body).join(", ") || "options"}`,
          typeHint: "configuration",
          referencedConfiguration: Object.freeze(detectKeys(body)),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.9,
        },
      ]);
    },
  };
}

/** Detect which known configuration options appear in a config body. */
export function detectKeys(content: string): readonly string[] {
  const found: string[] = [];
  for (const key of KNOWN_CONFIG_KEYS) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|["']|\\s)${escaped}["']?\\s*:`).test(content)) found.push(key);
  }
  return Object.freeze(found);
}

function languageFor(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".toml")) return "toml";
  return "text";
}
