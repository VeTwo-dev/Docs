/**
 * API Baseline Persistence under `.vetwo/docs/`.
 *
 * Stores the last approved `ApiSymbol[]` snapshot so CI can fail on
 * unapproved breaking changes. Baseline file is never loaded as source of
 * truth for generation — only for comparison.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ApiSymbol } from "./models.js";

export const BASELINE_RELATIVE = ".vetwo/docs/api-baseline.json";

export interface ApiBaselineFile {
  readonly version: 1;
  readonly generatedAt: string;
  readonly symbols: readonly ApiSymbol[];
}

export function baselinePath(rootDir: string): string {
  return join(rootDir, BASELINE_RELATIVE);
}

export function readBaseline(rootDir: string): ApiBaselineFile | undefined {
  const p = baselinePath(rootDir);
  if (!existsSync(p)) return undefined;
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as ApiBaselineFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.symbols)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeBaseline(rootDir: string, symbols: readonly ApiSymbol[]): string {
  const p = baselinePath(rootDir);
  mkdirSync(dirname(p), { recursive: true });
  const file: ApiBaselineFile = { version: 1, generatedAt: new Date().toISOString(), symbols: [...symbols] };
  writeFileSync(p, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  return p;
}
