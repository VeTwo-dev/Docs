/**
 * CLI Command Discovery (Phase 22.4).
 *
 * Discovers real CLI commands from evidence, never invented:
 * 1. `package.json#bin` entries (command names).
 * 2. Commander-style `.command("name")` + `.description("...")` calls in
 *    source (bounded regex scan — syntactic, no execution).
 * 3. `package.json#scripts` as fallback hints are NOT commands (kept separate).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";

const { globSync } = fg as unknown as {
  globSync: (patterns: string[], options: Record<string, unknown>) => string[];
};

export interface DiscoveredCommand {
  readonly name: string;
  readonly description?: string;
}

const COMMAND_RE = /\.command\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const DESCRIPTION_RE = /\.description\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const MAX_FILES = 40;
const MAX_COMMANDS = 30;

/** Discover CLI commands exposed by a project. Deterministic, bounded. */
export function discoverCliCommands(rootDir: string): DiscoveredCommand[] {
  const found = new Map<string, string | undefined>();

  // 1. package.json bin entries are real user-facing commands.
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
      bin?: string | Record<string, string>;
    };
    if (typeof pkg.bin === "string") {
      const name = (pkg as { name?: string }).name ?? "cli";
      found.set(String(name).split("/").pop() ?? "cli", undefined);
    } else if (pkg.bin !== undefined) {
      for (const name of Object.keys(pkg.bin)) found.set(name, undefined);
    }
  } catch {
    // No package.json — no bin evidence.
  }

  // 2. Commander-style definitions in source (name + adjacent description).
  let files: string[];
  try {
    files = globSync(["src/**/*.{ts,js,tsx,jsx}", "bin/**/*", "cli/**/*"], {
      cwd: rootDir,
      absolute: false,
      ignore: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "node_modules/**",
        "dist/**",
        "docs/**",
      ],
    }).slice(0, MAX_FILES);
  } catch {
    files = [];
  }
  for (const rel of files) {
    if (found.size >= MAX_COMMANDS) break;
    let text: string;
    try {
      text = readFileSync(join(rootDir, rel), "utf8");
    } catch {
      continue;
    }
    // Strip comments so commented-out commands are never discovered.
    text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    // Pair each .command() with the nearest following .description() in the chain.
    for (const match of text.matchAll(COMMAND_RE)) {
      const name = match[1]?.trim();
      if (name === undefined || name.length === 0 || name.includes(" ") || found.has(name))
        continue;
      const tail = text.slice(match.index ?? 0, (match.index ?? 0) + 300);
      const desc = DESCRIPTION_RE.exec(tail)?.[1]?.trim();
      // Reset lastIndex since we reuse the global regex on slices.
      DESCRIPTION_RE.lastIndex = 0;
      found.set(name, desc);
      if (found.size >= MAX_COMMANDS) break;
    }
  }

  return [...found.entries()]
    .map(([name, description]) => (description !== undefined ? { name, description } : { name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
