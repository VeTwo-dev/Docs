/**
 * Semantic Content Diff.
 *
 * Produces meaningful documentation diffs (not line diffs):
 * "Heading renamed", "Example updated", "Section removed",
 * "User-authored section preserved".
 */

import type { IRBlock } from "../documentation/compiler/ir.js";
import { fingerprintBlock } from "./fingerprint.js";

/** One semantic change between two versions of a page body. */
export interface SemanticChange {
  readonly kind:
    | "heading-renamed"
    | "heading-added"
    | "heading-removed"
    | "content-updated"
    | "content-added"
    | "content-removed"
    | "section-removed"
    | "example-updated"
    | "description-changed";
  readonly subject: string;
  readonly before?: string;
  readonly after?: string;
}

/** Compare two ordered block lists semantically. */
export function semanticDiff(
  before: readonly IRBlock[],
  after: readonly IRBlock[],
): readonly SemanticChange[] {
  const changes: SemanticChange[] = [];

  const headingsOf = (blocks: readonly IRBlock[]): Map<string, IRBlock> => {
    const map = new Map<string, IRBlock>();
    for (const b of blocks) {
      if (b.kind === "heading") map.set(b.text.toLowerCase(), b);
    }
    return map;
  };

  const beforeHeadings = headingsOf(before);
  const afterHeadings = headingsOf(after);

  // Heading renames / additions / removals.
  for (const [key, block] of afterHeadings) {
    if (!beforeHeadings.has(key)) {
      // Is it a rename of a heading that disappeared?
      const removed = [...beforeHeadings.entries()].find(
        ([oldKey, oldBlock]) =>
          !afterHeadings.has(oldKey) &&
          oldBlock.kind === "heading" &&
          block.kind === "heading" &&
          oldBlock.level === block.level,
      );
      if (removed !== undefined && block.kind === "heading") {
        changes.push({
          kind: "heading-renamed",
          subject: removed[1].kind === "heading" ? removed[1].text : "",
          before: removed[1].kind === "heading" ? removed[1].text : "",
          after: block.text,
        });
      } else if (block.kind === "heading") {
        changes.push({ kind: "heading-added", subject: block.text });
      }
    }
  }
  for (const [key, block] of beforeHeadings) {
    if (!afterHeadings.has(key)) {
      const renamedAway = changes.some(
        (c) => c.kind === "heading-renamed" && block.kind === "heading" && c.before === block.text,
      );
      if (!renamedAway && block.kind === "heading") {
        changes.push({ kind: "section-removed", subject: block.text });
      }
    }
  }

  // Content-level add/remove/update by fingerprint sets.
  const beforeFps = new Map(before.map((b) => [fingerprintBlock(b), b] as const));
  const afterFps = new Map(after.map((b) => [fingerprintBlock(b), b] as const));

  for (const block of after) {
    if (!beforeFps.has(fingerprintBlock(block))) {
      changes.push({
        kind: block.kind === "code" ? "example-updated" : "content-added",
        subject: describe(block),
      });
    }
  }
  for (const block of before) {
    if (!afterFps.has(fingerprintBlock(block))) {
      changes.push({
        kind: "content-removed",
        subject: describe(block),
      });
    }
  }

  return changes;
}

function describe(block: IRBlock): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "callout":
      return block.text.slice(0, 60);
    case "code":
      return `${block.language} example`;
    case "table":
      return `table (${block.headers.length} columns)`;
    default:
      return block.kind;
  }
}
