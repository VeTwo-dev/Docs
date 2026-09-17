import type { Example } from "./example.js";
import { normalizeForCompare, hashString } from "../shared/hash.js";

/**
 * Duplicate grouping for near-identical examples.
 *
 * Duplicates are never deleted: they are represented as a primary example
 * with alternate examples and duplicate candidates.
 */
export interface DuplicateGroup {
  /** The canonical example kept for documentation. */
  readonly primaryId: string;
  /** Examples that represent the same usage pattern. */
  readonly alternateIds: readonly string[];
  /** Examples that are equivalent but less canonical. */
  readonly duplicateCandidateIds: readonly string[];
  /** The similarity that tied the group together. */
  readonly similarity: number;
  /** The normalized usage pattern that matched. */
  readonly pattern: string;
}

/** A normalized usage signature for duplicate detection. */
export interface ExampleSignature {
  readonly pattern: string;
  readonly symbols: readonly string[];
  readonly packages: readonly string[];
}

/** Compute a normalized usage signature for an example. */
export function signatureOf(example: Example): ExampleSignature {
  const pattern = normalizeForCompare(example.content);
  const symbols = [...example.referencedSymbols].sort();
  const packages = [...example.referencedPackages].sort();
  return Object.freeze({
    pattern,
    symbols: Object.freeze(symbols),
    packages: Object.freeze(packages),
  });
}

/**
 * Detect duplicate/near-duplicate examples by normalized content.
 *
 * Two examples are duplicates when their normalized usage patterns are
 * identical or overlap on a shared token set. Groups pick the highest-scoring
 * example as primary.
 */
export function groupDuplicates(
  examples: readonly Example[],
  score: (example: Example) => number,
): readonly DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<string>();

  for (const example of examples) {
    if (assigned.has(example.id)) continue;
    const signature = signatureOf(example);
    const matches = examples.filter((candidate) => {
      if (candidate.id === example.id) return false;
      const candidateSignature = signatureOf(candidate);
      return isDuplicateSignature(signature, candidateSignature);
    });

    const groupMembers = [example, ...matches].sort((a, b) => score(b) - score(a));
    if (groupMembers.length === 1) continue;

    const primary = groupMembers[0]!;
    const alternatives = groupMembers.slice(1);
    const ids = alternatives.map((a) => a.id);
    for (const member of groupMembers) assigned.add(member.id);

    groups.push(
      Object.freeze({
        primaryId: primary.id,
        alternateIds: Object.freeze(ids),
        duplicateCandidateIds: Object.freeze(ids),
        similarity: alternatives.length > 0 ? 1 : 0,
        pattern: signature.pattern,
      }),
    );
  }

  return Object.freeze(groups);
}

/** Whether two signatures represent the same usage pattern. */
export function isDuplicateSignature(a: ExampleSignature, b: ExampleSignature): boolean {
  if (a.pattern.length > 0 && a.pattern === b.pattern) return true;
  const sharedSymbols = a.symbols.filter((symbol) => b.symbols.includes(symbol)).length;
  return sharedSymbols > 0 && sharedSymbols === Math.min(a.symbols.length, b.symbols.length);
}

export { hashString };
