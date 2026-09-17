/**
 * Rendered-site filesystem writer.
 *
 * The only place a renderer touches disk. Kept separate so rendering
 * stays pure and testable.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type { RenderedSite } from "./types.js";

/**
 * Write a rendered site to an output directory.
 * Paths are constrained inside `outputDir` (traversal-safe).
 */
export function writeRenderedSite(site: RenderedSite, outputDir: string): readonly string[] {
  const root = resolve(outputDir);
  mkdirSync(root, { recursive: true });

  const written: string[] = [];
  for (const file of site.files) {
    const target = resolve(join(root, file.path));
    if (!target.startsWith(root + sep) && target !== root) {
      throw new Error(`Refusing to write outside output directory: ${file.path}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.contents, "utf-8");
    written.push(file.path);
  }
  return written;
}
