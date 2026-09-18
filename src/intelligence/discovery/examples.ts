import { join } from "node:path";
import fg from "fast-glob";
type GlobSyncFn = (patterns: string[], options: Record<string, unknown>) => string[];
const { globSync } = fg as unknown as { globSync: GlobSyncFn };

export interface ExampleMeta {
  readonly title: string;
  readonly path: string;
  readonly source: string;
}

/**
 * Discovers candidate example files (examples/, fixtures, README).
 *
 * @param rootDir - Project root to scan.
 * @returns Example metadata with title, path and source kind.
 */
export function discoverExamples(rootDir: string): ExampleMeta[] {
  const patterns = ["examples/**/*", "example/**/*", "fixtures/**/*", "README.md"];
  const files = globSync(patterns, { cwd: rootDir, absolute: false }).slice(0, 30);
  return files.map((p) => ({
    title: p,
    path: join(rootDir, p),
    source: p.startsWith("examples") ? "examples" : p.includes("README") ? "readme" : "tests",
  }));
}
