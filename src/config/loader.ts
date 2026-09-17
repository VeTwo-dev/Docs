import type { DocsConfig, DocsConfigInput } from "./types.js";
import type { Plugin } from "../types/internal.js";
import type { PackageJson } from "pkg-types";
import { CONFIG_FILE_NAMES, PACKAGE_NAME } from "../constants/defaults.js";
import { defineDocs } from "./define.js";
import { validateConfig, validateConfigWarnings } from "./validation.js";
import { resolve, join, dirname } from "pathe";
import { existsSync, readFileSync } from "node:fs";

/** Result of loading and resolving the documentation configuration. */
export interface ConfigLoadResult {
  readonly config: DocsConfig;
  readonly filePath: string;
}

function findConfigFile(rootDir: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = join(rootDir, name);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return undefined;
}

function findPackageJson(rootDir: string): Record<string, unknown> | undefined {
  const packagePath = join(rootDir, "package.json");
  if (existsSync(packagePath)) {
    const content = readFileSync(packagePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Walks up from `startDir` looking for a monorepo root.
 *
 * A directory is considered the monorepo root when it contains any of:
 * - `pnpm-workspace.yaml`
 * - `lerna.json`
 * - a `package.json` with a `workspaces` field
 *
 * @param startDir - Absolute path to start the search from.
 * @returns The absolute path to the monorepo root, or `undefined` when none is found.
 */
export function findMonorepoRoot(startDir: string): string | undefined {
  let dir = startDir;

  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || existsSync(join(dir, "lerna.json"))) {
      return dir;
    }

    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(raw) as PackageJson;
        if (pkg.workspaces !== undefined) {
          return dir;
        }
      } catch {
        // ignore malformed package.json
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

/**
 * Loads the documentation configuration from the project root directory.
 * Looks for a config file in supported formats, falling back to extracting
 * configuration from `package.json` under the `@vetwo/docs` key.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @returns The resolved configuration and the path to the file it was loaded from.
 *
 * @example
 * ```ts
 * const { config, filePath } = await loadConfig("/path/to/project");
 * ```
 */
export async function loadConfig(rootDir: string): Promise<ConfigLoadResult> {
  const configPath = findConfigFile(rootDir);

  if (configPath) {
    const mod = await import(configPath);
    const userConfig: DocsConfigInput = (mod.default ?? mod) as DocsConfigInput;
    validateConfig(userConfig);
    const warnings = validateConfigWarnings(userConfig);
    for (const warning of warnings) {
      console.warn(`[docs] Warning: ${warning}`);
    }
    const config = defineDocs(userConfig);
    return { config, filePath: configPath };
  }

  const packageJson = findPackageJson(rootDir);
  const configFromPackage = (packageJson?.[PACKAGE_NAME] as DocsConfigInput | undefined) ?? {};

  validateConfig(configFromPackage);
  const config = defineDocs(configFromPackage);
  return { config, filePath: join(rootDir, "package.json") };
}

/**
 * Resolves the absolute path to the documentation configuration file.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param configPath - Optional explicit path to a config file. If omitted, `rootDir` is used.
 * @returns The resolved absolute path.
 *
 * @example
 * ```ts
 * const path = resolveConfigPath("/project", "./my-config.ts");
 * ```
 */
export function resolveConfigPath(rootDir: string, configPath?: string): string {
  if (configPath) {
    return resolve(rootDir, configPath);
  }
  return resolve(rootDir);
}

/**
 * Merges two lists of plugins, deduplicating by name. Plugins in `existing`
 * take precedence over those in `additional` with the same name.
 *
 * @param existing - The base list of plugins.
 * @param additional - Additional plugins to merge in.
 * @returns A new array containing all unique plugins.
 *
 * @example
 * ```ts
 * const merged = mergePlugins([pluginA], [pluginB, pluginA]);
 * // Result: [pluginA, pluginB]
 * ```
 */
export function mergePlugins(
  existing: readonly Plugin[],
  additional: readonly Plugin[],
): readonly Plugin[] {
  const existingNames = new Set(existing.map((p) => p.name));
  const unique = additional.filter((p) => !existingNames.has(p.name));
  return [...existing, ...unique];
}
