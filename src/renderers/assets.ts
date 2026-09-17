/**
 * Central Asset Registry (Phase 22.2).
 *
 * Discovers image assets referenced by IR `image` blocks, validates them
 * against the source boundary, and plans renderer-specific materialization:
 * - next → `public/assets/<name>`
 * - static → `assets/images/<name>`
 * - markdown → stable source-relative reference (unchanged src)
 *
 * Never emits absolute source filesystem paths into output.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep, basename, extname } from "node:path";

export interface PlannedAsset {
  readonly id: string;
  readonly sourcePath: string;
  readonly nextPath: string;
  readonly staticPath: string;
  readonly markdownRef: string;
  readonly bytes?: Uint8Array;
  readonly missing: boolean;
}

export interface AssetPlan {
  readonly assets: readonly PlannedAsset[];
  readonly missing: readonly string[];
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico"]);

function slugifyAsset(src: string): string {
  const base = basename(src).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "asset";
}

/** Discover image sources referenced by the IR. */
export function discoverImageSources(
  imageSrcs: readonly string[],
  allowedDirs: readonly string[],
): AssetPlan {
  const seen = new Map<string, PlannedAsset>();
  const missing: string[] = [];

  for (const src of imageSrcs) {
    if (seen.has(src)) continue;
    // External URLs and data URIs are passed through untouched.
    if (/^(https?:|data:)/.test(src)) {
      const asset: PlannedAsset = {
        id: src,
        sourcePath: src,
        nextPath: src,
        staticPath: src,
        markdownRef: src,
        missing: false,
      };
      seen.set(src, asset);
      continue;
    }
    const name = slugifyAsset(src);
    // Resolve against allowed source boundaries only.
    let resolved: string | undefined;
    for (const dir of allowedDirs) {
      const candidate = resolve(join(dir, src));
      if (!candidate.startsWith(resolve(dir) + sep) && candidate !== resolve(dir)) continue;
      if (existsSync(candidate)) {
        resolved = candidate;
        break;
      }
    }
    if (resolved === undefined) {
      missing.push(src);
      seen.set(src, {
        id: src,
        sourcePath: src,
        nextPath: `assets/${name}`,
        staticPath: `assets/images/${name}`,
        markdownRef: src,
        missing: true,
      });
      continue;
    }
    let bytes: Uint8Array | undefined;
    try {
      const ext = extname(resolved).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) bytes = readFileSync(resolved);
    } catch {
      bytes = undefined;
    }
    seen.set(src, {
      id: src,
      sourcePath: resolved,
      nextPath: `public/assets/${name}`,
      staticPath: `assets/images/${name}`,
      markdownRef: src,
      bytes,
      missing: false,
    });
  }

  return { assets: [...seen.values()], missing };
}
