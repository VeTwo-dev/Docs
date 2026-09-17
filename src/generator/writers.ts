import type { GeneratedPage, GeneratedMetadata } from "./core/types.js";
import { writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Writes generated pages and metadata files to disk.
 * In non-overwrite mode, skips files that already exist.
 */
export function writeGeneratedOutput(
  outputDir: string,
  pages: readonly GeneratedPage[],
  metadata: readonly GeneratedMetadata[],
  overwrite: boolean,
): { written: number; skipped: number } {
  ensureDir(outputDir);

  let written = 0;
  let skipped = 0;

  for (const page of pages) {
    const filePath = join(outputDir, `${page.slug}.mdx`);
    if (!overwrite && existsSync(filePath)) {
      skipped++;
      continue;
    }
    ensureDir(dirname(filePath));
    writeFileSync(filePath, page.content, "utf-8");
    written++;
  }

  for (const meta of metadata) {
    const filePath = join(outputDir, meta.filename);
    if (!overwrite && existsSync(filePath)) {
      skipped++;
      continue;
    }
    ensureDir(dirname(filePath));
    writeFileSync(filePath, meta.content, "utf-8");
    written++;
  }

  return { written, skipped };
}

/**
 * Cleans the generated output directory.
 */
export function cleanGeneratedOutput(outputDir: string): void {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

/**
 * Lists all files in a directory recursively.
 */
export function listGeneratedFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  walkDir(dir, files);
  return files;
}

function walkDir(dir: string, result: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, result);
      } else {
        result.push(fullPath);
      }
    } catch {
      continue;
    }
  }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
