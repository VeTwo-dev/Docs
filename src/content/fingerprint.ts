/**
 * Content Fingerprints.
 *
 * Stable fingerprints for IR blocks, used by overrides (block matching),
 * composition (change detection) and the ownership manifest.
 */

import { hashString } from "../utils/hash.js";
import type { IRBlock } from "../documentation/compiler/ir.js";

/** Compute a stable fingerprint for a single block. */
export function fingerprintBlock(block: IRBlock): string {
  return hashString(stableBlockJson(block));
}

/** Compute a combined fingerprint for an ordered block list. */
export function fingerprintBlocks(blocks: readonly IRBlock[]): string {
  return hashString(blocks.map((b) => stableBlockJson(b)).join("|"));
}

function stableBlockJson(block: IRBlock): string {
  return JSON.stringify(block, Object.keys(block as object).sort());
}
