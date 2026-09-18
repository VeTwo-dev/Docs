import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FRAMEWORKS: Record<string, string[]> = {
  "Next.js": ["next", "next.config"],
  React: ["react", "react-dom"],
  Vite: ["vite", "vite.config"],
  Vue: ["vue", "@vue/compiler-sfc"],
  Nuxt: ["nuxt"],
  Astro: ["astro"],
  Svelte: ["svelte"],
  Express: ["express"],
  NestJS: ["@nestjs/core"],
  Hono: ["hono"],
};

/**
 * Detects the project framework from dependencies and config files.
 *
 * @param rootDir - Project root to inspect.
 * @returns Framework display name, or undefined when none detected.
 */
export function detectFramework(rootDir: string): string | undefined {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  } catch {
    // Best-effort discovery — ignore unreadable entries.
  }
  const deps = new Set([
    ...Object.keys((pkg["dependencies"] as Record<string, string> | undefined) ?? {}),
    ...Object.keys((pkg["devDependencies"] as Record<string, string> | undefined) ?? {}),
  ]);
  for (const [name, hints] of Object.entries(FRAMEWORKS)) {
    if (
      hints.some(
        (h) =>
          deps.has(h) ||
          existsSync(join(rootDir, `${h}.js`)) ||
          existsSync(join(rootDir, `${h}.ts`)),
      )
    )
      return name;
  }
  return undefined;
}
