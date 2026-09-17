import {  } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
const { globSync } = fg as unknown as { globSync: typeof import("fast-glob").globSync };

export interface ExampleMeta { readonly title: string; readonly path: string; readonly source: string; }

export function discoverExamples(rootDir: string): ExampleMeta[] {
  const patterns = ["examples/**/*", "example/**/*", "fixtures/**/*", "README.md"];
  const files = globSync(patterns, { cwd: rootDir, absolute: false }).slice(0, 30);
  return files.map(p => ({ title: p, path: join(rootDir, p), source: p.startsWith("examples") ? "examples" : p.includes("README") ? "readme" : "tests" }));
}
