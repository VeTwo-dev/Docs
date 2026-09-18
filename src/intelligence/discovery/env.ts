import { readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
type GlobSyncFn = (patterns: string[], options: Record<string, unknown>) => string[];
const { globSync } = fg as unknown as { globSync: GlobSyncFn };

export interface EnvVar {
  readonly name: string;
  readonly source: string;
  readonly secret?: boolean;
}

const ENV_RE =
  /process\.env\.([A-Z0-9_]+)|process\.env\["([A-Z0-9_]+)"\]|import\.meta\.env\.([A-Z0-9_]+)/g;
const SECRET_HINT = /SECRET|TOKEN|KEY|PASSWORD|API/i;

/**
 * Discovers environment variable names referenced in source (never values).
 *
 * @param rootDir - Project root to scan.
 * @returns Variable names with source file and secrecy heuristic.
 */
export function discoverEnvVars(rootDir: string): EnvVar[] {
  const files = globSync(["src/**/*.{ts,js,tsx,jsx}", "config/**/*.{ts,js}", "*.config.*"], {
    cwd: rootDir,
    absolute: false,
  }).slice(0, 200);
  const found = new Map<string, string>();
  for (const rel of files) {
    try {
      const content = readFileSync(join(rootDir, rel), "utf8");
      let m: RegExpExecArray | null;
      ENV_RE.lastIndex = 0;
      while ((m = ENV_RE.exec(content)) !== null) {
        const name = m[1] ?? m[2] ?? m[3];
        if (name) found.set(name, rel);
      }
    } catch {
      // Best-effort discovery — ignore unreadable entries.
    }
  }
  return [...found.entries()].map(([name, source]) => ({
    name,
    source,
    secret: SECRET_HINT.test(name),
  }));
}
