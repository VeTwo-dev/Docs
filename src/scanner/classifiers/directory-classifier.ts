import type { DirectoryCategory } from "../types/categories.js";
import type { DirectoryClassifier, DirectoryClassificationInput } from "./types.js";

/** Directory names mapped to their purpose category. */
const DIRECTORY_CATEGORY_BY_NAME: Readonly<Record<string, DirectoryCategory>> = {
  src: "src",
  lib: "src",
  libs: "src",
  core: "src",
  source: "src",
  docs: "docs",
  documentation: "docs",
  site: "docs",
  wiki: "docs",
  examples: "examples",
  example: "examples",
  demos: "examples",
  demo: "examples",
  packages: "packages",
  pkg: "packages",
  apps: "apps",
  app: "apps",
  applications: "apps",
  playground: "playground",
  play: "playground",
  stories: "stories",
  storybook: "stories",
  tests: "tests",
  test: "tests",
  __tests__: "tests",
  __specs__: "tests",
  e2e: "tests",
  fixtures: "tests",
  specs: "tests",
  scripts: "scripts",
  script: "scripts",
  bin: "scripts",
  tasks: "scripts",
  tools: "scripts",
  assets: "assets",
  static: "public",
  public: "public",
  dist: "dist",
  out: "dist",
  esm: "dist",
  cjs: "dist",
  umd: "dist",
  coverage: "coverage",
  cache: "cache",
  ".cache": "cache",
  ".turbo": "cache",
  ".nx": "cache",
  ".docs-cache": "cache",
  ".vetwo": "cache",
  generated: "generated",
  gen: "generated",
  ".generated": "generated",
  vendor: "vendor",
  third_party: "vendor",
  "third-party": "vendor",
  deps: "vendor",
  ".venv": "vendor",
  node_modules: "node_modules",
  ".github": "ci",
  ".gitlab": "ci",
  ".circleci": "ci",
  ".github_actions": "ci",
  ".vscode": "ide",
  ".idea": "ide",
  ".cursor": "ide",
  ".editor": "ide",
};

/** The built-in directory classifier. */
export const directoryClassifier: DirectoryClassifier = (input) => classifyDirectory(input);

/**
 * Classifies a directory by its name.
 *
 * @param input - The directory to classify.
 * @returns The directory category (`unknown` when nothing matches).
 */
export function classifyDirectory(input: DirectoryClassificationInput): DirectoryCategory {
  if (input.depth === 0 || input.relativePath === ".") return "root";
  const lower = input.name.toLowerCase();
  return DIRECTORY_CATEGORY_BY_NAME[lower] ?? "unknown";
}
