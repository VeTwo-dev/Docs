/**
 * Documentation Composition Engine.
 *
 * Combines generated, AI-generated and user-authored content into the
 * final page bodies with deterministic merge priority:
 *
 *   protected user content → explicit overrides → user-authored →
 *   ai-generated → deterministic generated
 *
 * Never destroys user work: conflicts are reported, not overwritten.
 * Supports three-way merging against the previous generated version so
 * user edits survive regeneration.
 */

import type { IRBlock } from "../../documentation/compiler/ir.js";
import { diagnostic } from "../../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../../documentation/compiler/diagnostics.js";
import { fingerprintBlock } from "../fingerprint.js";

const fpOf = fingerprintBlock;
import type { CompositionResult, DocumentationContentOwnership, PageOverride } from "../types.js";
import { applyOverride } from "../overrides.js";

/** One content layer for a page. */
export interface ContentLayer {
  readonly ownership: DocumentationContentOwnership;
  readonly title?: string;
  readonly blocks: readonly IRBlock[];
}

/** Input to composing a single page. */
export interface ComposePageInput {
  readonly slug: string;
  /** Deterministic generated version (current). */
  readonly generated?: ContentLayer;
  /** Previous generated version (for three-way merge). */
  readonly previousGenerated?: ContentLayer;
  /** User-authored version (may be an edited copy of generated). */
  readonly user?: ContentLayer;
  /** Pure AI-proposed additions (never replaces user layers silently). */
  readonly ai?: ContentLayer;
  /** Explicit user overrides. */
  readonly override?: PageOverride;
  /** Page locked entirely by the user. */
  readonly protectedPage?: boolean;
}

/**
 * Compose a page from its layers.
 *
 * Rules:
 * - `protectedPage` → the user layer wins outright; no generation applied.
 * - If a user layer exists AND the generated layer changed since the
 *   previous generated version AND the user modified those same blocks,
 *   conflicting blocks are kept as user-authored + DOC_CONTENT_CONFLICT.
 * - Unmodified-by-user generated blocks are refreshed to the new version.
 * - AI blocks are appended only where they don't collide with user blocks.
 * - Overrides apply last on top of the merged result.
 */
export function composePage(input: ComposePageInput): CompositionResult {
  const conflicts: DocumentationDiagnostic[] = [];
  const { slug, generated, user, ai, override } = input;

  // ── Protected pages: user owns everything ─────────────────────────
  if (input.protectedPage === true && user !== undefined) {
    return {
      slug,
      title: user.title ?? slug,
      blocks: user.blocks.map((block, index) => ({
        index,
        block,
        ownership: "user-authored" as const,
      })),
      conflicts,
      provenance: { source: "user", sourceReferences: [] },
    };
  }

  const genBlocks = generated?.blocks ?? [];
  const userBlocks = user?.blocks;

  let finalBlocks: { block: IRBlock; ownership: DocumentationContentOwnership }[];

  if (userBlocks === undefined) {
    // No user content: generated + optional AI additions.
    finalBlocks = [
      ...genBlocks.map((block) => ({ block, ownership: "generated" as const })),
      ...(ai?.blocks ?? []).map((block) => ({
        block,
        ownership: "ai-generated" as const,
      })),
    ];
  } else if (genBlocks.length === 0) {
    // Generated content disappeared; keep user content untouched and
    // still allow non-duplicative AI additions.
    const existingFps = new Set(userBlocks.map(fpOf));
    finalBlocks = [
      ...userBlocks.map((block) => ({
        block,
        ownership: "user-authored" as const,
      })),
      ...(ai?.blocks ?? [])
        .filter((block) => !existingFps.has(fpOf(block)))
        .map((block) => ({
          block,
          ownership: "ai-generated" as const,
        })),
    ];
  } else {
    // Three-way merge at block granularity.
    finalBlocks = threeWayMerge({
      slug,
      previous: input.previousGenerated?.blocks ?? genBlocks,
      currentGenerated: genBlocks,
      currentUser: userBlocks,
      aiBlocks: ai?.blocks ?? [],
      conflicts,
    });
  }

  // Apply explicit overrides last.
  const target = {
    title: user?.title ?? generated?.title ?? slug,
    description: undefined,
    blocks: finalBlocks.map((entry, index) => ({ index, ...entry })),
  };
  if (override !== undefined) {
    applyOverride(target, override);
  }
  void overrideSatisfied(target);

  return {
    slug,
    title: target.title,
    blocks: target.blocks,
    conflicts,
    provenance: {
      source: target.blocks.some((b) => b.ownership === "ai-generated")
        ? "ai"
        : target.blocks.every((b) => b.ownership === "user-authored")
          ? "user"
          : "compiler",
      sourceReferences: [],
      fingerprint: String(target.blocks.length),
    },
  };
}

function overrideSatisfied(_target: unknown): boolean {
  return true;
}

// ─── Three-way merge ─────────────────────────────────────────────────────

interface MergeInput {
  readonly slug: string;
  readonly previous: readonly IRBlock[];
  readonly currentGenerated: readonly IRBlock[];
  readonly currentUser: readonly IRBlock[];
  readonly aiBlocks: readonly IRBlock[];
  readonly conflicts: DocumentationDiagnostic[];
}

/**
 * Block-level three-way merge.
 *
 * Blocks are keyed by fingerprint. For each key present in both the
 * previous and current generated versions:
 * - user kept old block unchanged → take new generated block.
 * - user edited old block AND generated changed → keep user's edit,
 *   emit DOC_CONTENT_CONFLICT describing both versions.
 * - user added new blocks → preserved in place order after their anchor.
 * - generated removed a block the user never touched → removed.
 */
export function threeWayMerge(input: MergeInput): {
  block: IRBlock;
  ownership: DocumentationContentOwnership;
}[] {
  const { previous, currentGenerated, currentUser, conflicts, slug } = input;

  const fp = fingerprintBlock;
  const result: { block: IRBlock; ownership: DocumentationContentOwnership }[] = [];
  let p = 0; // cursor into previous
  let u = 0; // cursor into currentUser
  let g = 0; // cursor into currentGenerated

  while (u < currentUser.length) {
    const userBlock = currentUser[u];
    if (userBlock === undefined) break;

    // ── Anchor: user block unchanged from the previous generated version.
    if (p < previous.length) {
      const prevBlock = previous[p];
      if (prevBlock !== undefined && fp(prevBlock) === fp(userBlock)) {
        // Take the newest generated counterpart (refresh), whatever it is:
        // if generated updated this block, the user (who didn't touch it)
        // receives the update transparently.
        const counterpart = g < currentGenerated.length ? currentGenerated[g] : undefined;
        result.push({
          block: counterpart ?? userBlock,
          ownership: "generated",
        });
        if (counterpart !== undefined) g++;
        p++;
        u++;
        continue;
      }
    }

    // ── Gap: collect diverging regions on both sides up to the next anchor.
    const gapUser: IRBlock[] = [];
    while (
      u < currentUser.length &&
      !(
        p < previous.length &&
        previous[p] !== undefined &&
        fp(currentUser[u]!) === fp(previous[p]!)
      )
    ) {
      gapUser.push(currentUser[u]!);
      u++;
    }
    const gapPrev: IRBlock[] = [];
    while (
      p < previous.length &&
      (u >= currentUser.length || fp(previous[p]!) !== fp(currentUser[u]!))
    ) {
      gapPrev.push(previous[p]!);
      p++;
    }

    // Determine whether upstream changed this region by locating each
    // previously-generated block's counterpart in the new version.
    let upstreamChanged = false;
    for (const prevGapBlock of gapPrev) {
      const found = findMatchingGenerated(currentGenerated, g, prevGapBlock);
      if (found === -1 || fp(currentGenerated[found]!) !== fp(prevGapBlock)) {
        // Counterpart missing or moved — treat as upstream change only when
        // genuinely absent from the new version.
        if (!currentGenerated.some((b) => fp(b) === fp(prevGapBlock))) {
          upstreamChanged = true;
          break;
        }
      } else {
        g = found + 1; // consume unchanged counterparts
      }
    }

    // User content always wins in a gap; conflicts are reported, never
    // silently overwritten.
    for (const block of gapUser) {
      result.push({ block, ownership: "user-authored" });
    }
    if (upstreamChanged && gapPrev.length > 0) {
      conflicts.push(
        diagnostic(
          "DOC_CONTENT_CONFLICT",
          "warning",
          `Generated content near "${describeBlock(gapPrev[0]!)}" diverges from your edited version.`,
          slug,
          "Keep your version, adopt the generated update, or merge manually.",
        ),
      );
    }
  }

  // Flush remaining generated blocks that trail all user content.
  while (g < currentGenerated.length) {
    const block = currentGenerated[g];
    if (block === undefined) break;
    result.push({ block, ownership: "generated" });
    g++;
  }

  // AI additions appended when they don't duplicate anything present.
  const existing = new Set(result.map((r) => fingerprintBlock(r.block)));
  for (const block of input.aiBlocks) {
    if (!existing.has(fingerprintBlock(block))) {
      result.push({ block, ownership: "ai-generated" });
    }
  }

  return result;
}

function findMatchingGenerated(
  generated: readonly IRBlock[],
  fromIndex: number,
  userBlock: IRBlock,
): number {
  const userFp = fingerprintBlock(userBlock);
  // Prefer the next occurrence at/after the cursor (order preservation).
  for (let i = fromIndex; i < generated.length; i++) {
    const block = generated[i];
    if (block !== undefined && fingerprintBlock(block) === userFp) return i;
  }
  return -1;
}

export function describeBlock(block: IRBlock): string {
  switch (block.kind) {
    case "heading":
      return block.text;
    case "paragraph":
      return block.text.slice(0, 60);
    case "code":
      return `${block.language} code block`;
    case "callout":
      return `${block.tone} note`;
    case "table":
      return "table";
    default:
      return block.kind;
  }
}
