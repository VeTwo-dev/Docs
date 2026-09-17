import type { GeneratorConfig, GeneratorConfigInput } from "./types.js";

const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  enabled: false,
  mode: "hybrid",
  output: "./generated-docs",
  overwrite: false,
  api: true,
  architecture: true,
  guides: true,
  configuration: true,
  cli: true,
  faq: true,
  troubleshooting: true,
  examples: true,
  recipes: true,
  changelog: true,
  search: true,
  sidebar: true,
  navigation: true,
};

/**
 * Creates a fully resolved generator config by merging user input with defaults.
 */
export function resolveGeneratorConfig(input?: GeneratorConfigInput): GeneratorConfig {
  if (!input) return DEFAULT_GENERATOR_CONFIG;
  return { ...DEFAULT_GENERATOR_CONFIG, ...input };
}
