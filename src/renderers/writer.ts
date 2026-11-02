/**
 * Rendered-site filesystem writer.
 *
 * The single ownership-aware boundary for generated website files.
 * `writeSiteFiles` is the only path website files reach disk through:
 * traversal-safe, ownership-preserving (never overwrites user edits),
 * and marker-stamping for later reconciliation. `writeRenderedSite`
 * retains its historical signature and traversal error as a thin
 * compatibility wrapper delegating to the same implementation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Logger } from "../types/internal.js";
import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import {
  markGeneratedFor,
  shouldOverwrite,
  stripOwnershipMarker,
} from "../documentation/compiler/ownership.js";
import type { RenderedSite } from "./types.js";

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  success: () => {},
  spin: () => ({
    succeed: () => {},
    fail: () => {},
    warn: () => {},
    info: () => {},
    stop: () => {},
    text: "",
  }),
  progress: () => {},
  box: () => {},
  table: () => {},
};

/**
 * Write a rendered site to an output directory, honoring ownership.
 *
 * Paths are constrained inside `outputRoot` (traversal-safe). JSON payloads
 * (page data, manifests, search) are deterministic build artifacts and are
 * always refreshed. Source files (`.mdx`/`.tsx`/`.html`/`.css`) preserve
 * user edits: byte-identical content modulo ownership markers is adopted,
 * previously inventoried files are provably generated, everything else
 * unknown is preserved with a warning — never overwritten.
 */
export function writeSiteFiles(
  site: RenderedSite,
  outputRoot: string,
  logger: Logger,
  written: string[],
  warnings: string[],
  isPreviouslyGenerated: (absPath: string) => boolean = () => false,
): void {
  mkdirSync(resolve(outputRoot), { recursive: true });
  for (const file of site.files) {
    const target = resolve(join(resolve(outputRoot), file.path));
    if (target !== resolve(outputRoot) && !target.startsWith(resolve(outputRoot) + sep)) {
      throw new DocsError({
        code: ErrorCode.BUILD_FAILED,
        message: `Renderer ${site.target} escaped its root: ${file.path}`,
      });
    }
    // JSON payloads (page data, manifests, search) are deterministic build
    // artifacts regenerated every run — never user-edited, always refresh.
    // Source files (.mdx/.tsx/.html/.css) honor ownership to preserve edits.
    const isDerivedJson = file.path.endsWith(".json");
    if (!isDerivedJson) {
      const existing = existsSync(target) ? readFileSync(target, "utf8") : undefined;
      // Idempotent rewrite: identical bytes modulo ownership markers are
      // not a conflict — this also adopts files written before markers
      // existed, without ever touching real user edits. Files recorded in
      // our own previous manifest inventory are provably generated even
      // when they carry no marker.
      if (
        existing !== undefined &&
        stripOwnershipMarker(existing) !== stripOwnershipMarker(file.contents) &&
        !shouldOverwrite(existing, file.contents) &&
        !isPreviouslyGenerated(target)
      ) {
        warnings.push(`Preserving user-owned ${target}`);
        logger.warn(`Preserving user-owned ${target}`);
        continue;
      }
    }
    mkdirSync(dirname(target), { recursive: true });
    // Sources carry a format-appropriate generated header; JSON stays machine-readable.
    const contents = file.path.endsWith(".json")
      ? file.contents
      : markGeneratedFor(file.path, file.contents);
    writeFileSync(target, contents, "utf8");
    written.push(target);
  }
}

/**
 * Write copied asset bytes through the ownership boundary.
 *
 * Assets are binary build artifacts, not user-editable sources: identical
 * bytes are adopted without rewriting (still inventoried), previously
 * inventoried files are refreshed, and unknown pre-existing files are
 * preserved with a warning — never overwritten. Traversal outside
 * `outputRoot` is refused silently, matching historical copy-loop behavior.
 */
export function writeAssetBytes(
  outputRoot: string,
  relPath: string,
  bytes: Uint8Array,
  isPreviouslyGenerated: (absPath: string) => boolean,
  written: string[],
  warnings: string[],
  logger: Logger,
): void {
  const root = resolve(outputRoot);
  const target = resolve(join(root, relPath));
  if (target !== root && !target.startsWith(root + sep)) return;
  const next = Buffer.from(bytes);
  const existing = existsSync(target) ? readFileSync(target) : undefined;
  if (existing !== undefined && existing.equals(next)) {
    written.push(target);
    return;
  }
  if (existing !== undefined && !isPreviouslyGenerated(target)) {
    warnings.push(`Preserving user-owned asset ${target}`);
    logger.warn(`Preserving user-owned asset ${target}`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, next);
  written.push(target);
}

/**
 * Write a rendered site to an output directory.
 *
 * Compatibility wrapper: retains the historical `(site, outputDir)` signature
 * and traversal error, delegating all writes to the ownership-aware
 * `writeSiteFiles` boundary. Returns paths actually written (relative);
 * user-owned files are preserved, not overwritten. Paths are constrained
 * inside `outputDir` (traversal-safe).
 */
export function writeRenderedSite(site: RenderedSite, outputDir: string): readonly string[] {
  const root = resolve(outputDir);
  mkdirSync(root, { recursive: true });
  for (const file of site.files) {
    const target = resolve(join(root, file.path));
    if (!target.startsWith(root + sep) && target !== root) {
      throw new Error(`Refusing to write outside output directory: ${file.path}`);
    }
  }
  const written: string[] = [];
  const warnings: string[] = [];
  writeSiteFiles(site, root, noopLogger, written, warnings);
  return written.map((abs) => relative(root, abs));
}
