/**
 * Canonical content discovery (Phase 3.6).
 *
 * Finds user documentation files (`*.md`, `*.mdx`) under configured content
 * roots and normalizes each one. No source-code scanning participates:
 * discovery is purely file-based, explicitly rooted, deterministically
 * ordered, and independent of ProjectKnowledge.
 */

import { resolve } from "node:path";
import { discoverDocFiles } from "../scanner/files.js";
import { readFile } from "../filesystem/index.js";
import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import { normalizeDocument } from "./normalize.js";
import type { CanonicalDocument, DiscoverContentOptions } from "./types.js";

/** Directories never treated as documentation sources by the canonical path. */
const ALWAYS_SKIPPED = ["generated"];

export interface DiscoverContentRoots {
  readonly rootDir: string;
  /** Content roots relative to rootDir (defaults to the resolved `source`). */
  readonly sourceDir: string;
}

/**
 * Discover + normalize every documentation file under the content root.
 * Returns documents sorted by content-root-relative path (deterministic).
 * Unreadable files and invalid MDX fail loudly with the offending path.
 */
export async function discoverContentDocuments(
  roots: DiscoverContentRoots,
  options: DiscoverContentOptions = {},
): Promise<readonly CanonicalDocument[]> {
  const sourceAbs = resolve(roots.rootDir, roots.sourceDir);
  const ignore = [...ALWAYS_SKIPPED.map((dir) => `${dir}/**`), ...(options.ignore ?? [])];
  const files = await discoverDocFiles(roots.rootDir, sourceAbs, ignore);

  const documents: CanonicalDocument[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = readFile(file.path);
    } catch (error) {
      throw new DocsError({
        code: ErrorCode.BUILD_FAILED,
        message: `Cannot read documentation file ${file.path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
    const relativePath = toPosix(
      file.path.startsWith(`${sourceAbs}/`) || file.path.startsWith(`${sourceAbs}\\`)
        ? file.path.slice(sourceAbs.length + 1)
        : file.relativePath,
    );
    documents.push(
      normalizeDocument({
        absolutePath: file.path,
        relativePath,
        raw,
        gfm: options.gfm,
        blogDir: options.blogDir,
      }),
    );
  }

  documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return documents;
}

function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}
