import type { ConfigFormat } from "../types/categories.js";
import { matchPath } from "../utils/glob.js";
import { getExtension } from "../utils/path.js";
import type { ConfigDetection, FileClassificationInput } from "./types.js";

/** Configuration file patterns grouped by the tool they belong to. */
export const CONFIG_FILE_PATTERNS: Readonly<Record<string, readonly string[]>> = {
  typescript: ["tsconfig.json", "tsconfig.*.json"],
  eslint: [
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
  ],
  prettier: [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.json5",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc.js",
    ".prettierrc.mjs",
    ".prettierrc.cjs",
    ".prettier.config.js",
    ".prettier.config.cjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ],
  biome: ["biome.json", "biome.jsonc"],
  babel: [".babelrc", ".babelrc.json", "babel.config.js", "babel.config.cjs", "babel.config.mjs"],
  swc: [".swcrc"],
  rspack: ["rspack.config.js", "rspack.config.mjs", "rspack.config.ts"],
  webpack: ["webpack.config.js", "webpack.config.cjs", "webpack.config.mjs", "webpack.config.ts"],
  rollup: ["rollup.config.js", "rollup.config.mjs", "rollup.config.ts"],
  vite: [
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.cts",
  ],
  vitest: ["vitest.config.js", "vitest.config.mjs", "vitest.config.ts"],
  jest: [
    "jest.config.js",
    "jest.config.ts",
    "jest.config.mjs",
    "jest.config.cjs",
    "jest.config.json",
  ],
  playwright: ["playwright.config.js", "playwright.config.ts", "playwright.config.mjs"],
  cypress: ["cypress.config.js", "cypress.config.ts", "cypress.config.mjs", "cypress.json"],
  turbo: ["turbo.json"],
  nx: ["nx.json"],
  changesets: [".changeset/config.json"],
  "github-actions": [".github/workflows/*.yml", ".github/workflows/*.yaml"],
  "gitlab-ci": [".gitlab-ci.yml"],
  docker: ["Dockerfile", "Dockerfile.*"],
  "docker-compose": [
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.*.yml",
    "docker-compose.*.yaml",
    "compose.yml",
    "compose.yaml",
  ],
  editorconfig: [".editorconfig"],
  renovate: [".renovaterc", ".renovaterc.json", "renovate.json", "renovate.json5"],
  dependabot: [".github/dependabot.yml", ".github/dependabot.yaml"],
  "package-manager": [
    "package.json",
    "pnpm-workspace.yaml",
    "lerna.json",
    "rush.json",
    ".npmrc",
    ".yarnrc",
    ".yarnrc.yml",
    ".yarnrc.yaml",
    "bunfig.toml",
    "moon.yml",
  ],
  lockfile: [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "npm-shrinkwrap.json",
  ],
  docs: [
    "docs.config.ts",
    "docs.config.js",
    "docs.config.mjs",
    "docs.config.cjs",
    "docs.config.json",
    "docs.config.yaml",
    "docs.config.yml",
    ".docsrc",
    ".docsrc.json",
  ],
};

/** The tools, in detection priority order. */
export const CONFIG_TOOL_ORDER: readonly string[] = Object.keys(CONFIG_FILE_PATTERNS);

/** Detects the configuration format from a file name and extension. */
export function detectConfigFormat(name: string, extension: string): ConfigFormat {
  const lowerName = name.toLowerCase();
  if (
    lowerName === ".swcrc" ||
    lowerName === ".babelrc" ||
    lowerName === ".npmrc" ||
    lowerName === ".yarnrc" ||
    lowerName === ".editorconfig" ||
    lowerName === ".prettierrc" ||
    lowerName === ".renovaterc" ||
    lowerName === ".eslintrc"
  ) {
    return "dotfile";
  }
  if (extension === ".jsonc" || extension === ".json5") return "jsonc";
  if (extension === ".json") return "json";
  if (extension === ".yaml" || extension === ".yml") return "yaml";
  if (extension === ".toml") return "toml";
  if (extension === ".ini") return "ini";
  if (extension === ".ts" || extension === ".mts" || extension === ".cts") return "ts";
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return "js";
  if (extension === "") return "dotfile";
  return "json";
}

/**
 * Identifies a configuration file and the tool it belongs to.
 *
 * @param input - The file to classify.
 * @returns The detected tool binding, or `null` when the file is not config.
 */
export function classifyConfigFile(input: FileClassificationInput): ConfigDetection | null {
  const rel = input.relativePath;
  for (const tool of CONFIG_TOOL_ORDER) {
    const patterns = CONFIG_FILE_PATTERNS[tool] ?? [];
    for (const pattern of patterns) {
      const matchesName = pattern.includes("/")
        ? matchPath(pattern, rel, { dot: true })
        : matchPath(pattern, input.name, { dot: true });
      if (matchesName) {
        const format = detectConfigFormat(input.name, getExtension(input.relativePath));
        return { tool, format };
      }
    }
  }
  return null;
}

/** Returns every tool that has a configuration file in the project. */
export function detectConfigTools(
  files: readonly {
    readonly relativePath: string;
    readonly name: string;
    readonly extension: string;
  }[],
): readonly string[] {
  const tools = new Set<string>();
  for (const file of files) {
    if (!isConfigCandidate(file)) continue;
    const detection = classifyConfigFile({
      name: file.name,
      relativePath: file.relativePath,
      extension: file.extension,
      dir: ".",
    });
    if (detection) tools.add(detection.tool);
  }
  return [...tools];
}

/** Fast pre-filter for config detection (avoids matching every file). */
function isConfigCandidate(file: { readonly name: string; readonly extension: string }): boolean {
  if (file.extension === ".json" || file.extension === ".jsonc" || file.extension === ".json5") {
    return true;
  }
  if (file.extension === ".yaml" || file.extension === ".yml" || file.extension === ".toml") {
    return true;
  }
  if (file.extension === ".js" || file.extension === ".mjs" || file.extension === ".cjs") {
    return file.name.includes("config") || file.name.startsWith(".");
  }
  if (file.extension === ".ts" || file.extension === ".mts" || file.extension === ".cts") {
    return file.name.includes("config");
  }
  return file.name.startsWith(".");
}
