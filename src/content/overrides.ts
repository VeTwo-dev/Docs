/**
 * Content Overrides.
 *
 * Applies user overrides to generated pages without forking them:
 * metadata replacement, section hiding, targeted block replacement,
 * and before/after extensions.
 */

import type { IRBlock } from "../documentation/compiler/ir.js";
import type { PageOverride } from "./types.js";
import { fingerprintBlock } from "./fingerprint.js";

/** A page body being overridden (mutable working copy). */
export interface OverrideTarget {
  title: string;
  description?: string;
  blocks: {
    index: number;
    block: IRBlock;
    ownership: "generated" | "ai-generated" | "user-authored" | "mixed" | "protected" | "derived";
  }[];
}

/**
 * Apply an override to a generated page target.
 * Deterministic; returns the number of modifications applied.
 */
export function applyOverride(target: OverrideTarget, override: PageOverride): number {
  let changes = 0;

  if (override.title !== undefined && override.title !== target.title) {
    target.title = override.title;
    // Keep H1 in sync with the overridden title.
    const h1 = target.blocks.find((b) => b.block.kind === "heading" && b.block.level === 1);
    if (h1 !== undefined && h1.block.kind === "heading") {
      target.blocks[h1.index] = {
        ...h1,
        block: { kind: "heading", level: 1, text: override.title },
      };
    }
    changes++;
  }

  if (override.description !== undefined) {
    target.description = override.description;
    changes++;
  }

  if (override.hideSections !== undefined && override.hideSections.length > 0) {
    const before = target.blocks.length;
    target.blocks = hideSections(target.blocks, override.hideSections);
    if (target.blocks.length !== before) changes++;
  }

  if (override.replaceBlocks !== undefined) {
    for (const [key, replacement] of Object.entries(override.replaceBlocks)) {
      const entry = target.blocks.find((b) => matchesKey(b.block, key));
      if (entry !== undefined) {
        target.blocks[entry.index] = { ...entry, block: replacement };
        changes++;
      }
    }
  }

  const insert = (items: readonly IRBlock[] | undefined, position: "start" | "end"): void => {
    if (items === undefined || items.length === 0) return;
    let cursor = position === "start" ? 0 : target.blocks.length;
    for (const block of items) {
      const entry = {
        index: cursor++,
        block,
        ownership: "user-authored" as const,
      };
      if (position === "start") {
        target.blocks.splice(cursor - 1, 0, entry);
      } else {
        target.blocks.push(entry);
      }
    }
    renumber(target.blocks);
    changes++;
  };

  insert(override.before, "start");
  insert(override.after, "end");

  return changes;
}

/**
 * Remove a named section: its heading and everything up to (but not
 * including) the next heading of the same or higher level.
 */
export function hideSections<T extends { index: number; block: IRBlock }>(
  blocks: readonly T[],
  names: readonly string[],
): T[] {
  const lowerNames = new Set(names.map((n) => n.toLowerCase()));
  const result: T[] = [];
  let hiding: { name: string; level: number } | null = null;

  for (const entry of blocks) {
    const block = entry.block;
    if (block.kind === "heading") {
      if (hiding !== null) {
        // Same or higher-level heading ends the hidden region.
        if (block.level <= hiding.level) hiding = null;
        else continue; // deeper heading inside hidden section
      }
      if (hiding === null && lowerNames.has(block.text.toLowerCase())) {
        hiding = { name: block.text, level: block.level };
        continue;
      }
    } else if (hiding !== null) {
      continue;
    }
    result.push(entry);
  }

  return result.map((entry, i) => ({ ...entry, index: i }));
}

/** Block matching key: exact fingerprint or `kind:text` shorthand. */
function matchesKey(block: IRBlock, key: string): boolean {
  return fingerprintBlock(block).startsWith(key) || blockKindText(block) === key;
}

function blockKindText(block: IRBlock): string {
  const text =
    block.kind === "heading" || block.kind === "paragraph" || block.kind === "callout"
      ? block.text
      : "";
  return `${block.kind}:${text}`;
}

function renumber<T extends { index: number }>(blocks: T[]): void {
  blocks.forEach((entry, i) => {
    entry.index = i;
  });
}
