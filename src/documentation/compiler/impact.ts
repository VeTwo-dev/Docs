/**
 * Documentation Impact Analysis.
 *
 * Classifies source changes and maps them onto affected documentation
 * pages via the symbol → concept → page chain. Supports rename detection,
 * deprecation handling, and minimal-regeneration decisions.
 */

import type { CompilerProjectInput } from "./types.js";

/** How a source element changed. */
export type SourceChangeKind =
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "moved"
  | "deprecated"
  | "signature-changed"
  | "behavior-changed"
  | "configuration-changed"
  | "dependency-changed"
  | "architecture-changed";

/** A classified source change. */
export interface SourceChange {
  readonly kind: SourceChangeKind;
  /** Symbol(s) affected. */
  readonly symbols?: readonly string[];
  /** File(s) affected. */
  readonly files?: readonly string[];
  /** Old name for renames. */
  readonly oldName?: string;
  /** New name for renames / deprecations (the replacement API). */
  readonly newName?: string;
}

/** The documentation impact of a set of changes. */
export interface DocumentationImpact {
  /** Pages needing regeneration (content or metadata). */
  readonly regenerate: readonly string[];
  /** Pages needing only link/reference updates (e.g. rename targets). */
  readonly relink: readonly string[];
  /** Pages to deprecate-mark (not delete). */
  readonly deprecate: readonly string[];
  /** New pages the changes call for. */
  readonly create: readonly string[];
  /** Whether navigation must be recomputed. */
  readonly navigationChanged: boolean;
  /** Rename mappings old slug/symbol → new. */
  readonly renames: readonly { from: string; to: string }[];
}

/** Rules per change kind: which page effects it produces. */
export function classifyImpact(
  changes: readonly SourceChange[],
  pages: readonly { slug: string; symbols: readonly string[]; kinds: readonly string[] }[],
): DocumentationImpact {
  const regenerate = new Set<string>();
  const relink = new Set<string>();
  const deprecate = new Set<string>();
  const create = new Set<string>();
  const renames: { from: string; to: string }[] = [];
  let navigationChanged = false;

  const pagesForSymbol = (symbol: string): string[] =>
    pages.filter((p) => p.symbols.includes(symbol)).map((p) => p.slug);

  for (const change of changes) {
    switch (change.kind) {
      case "added": {
        for (const symbol of change.symbols ?? []) {
          const owners = pagesForSymbol(symbol);
          if (owners.length === 0) {
            create.add(`api:${symbol}`);
          } else {
            for (const slug of owners) regenerate.add(slug);
          }
        }
        break;
      }
      case "removed": {
        for (const symbol of change.symbols ?? []) {
          for (const slug of pagesForSymbol(symbol)) regenerate.add(slug);
        }
        break;
      }
      case "modified":
      case "signature-changed":
      case "behavior-changed": {
        for (const symbol of change.symbols ?? []) {
          for (const slug of pagesForSymbol(symbol)) {
            regenerate.add(slug);
          }
        }
        for (const file of change.files ?? []) {
          for (const page of pages) {
            if (page.symbols.some((s) => file.includes(s.toLowerCase()))) {
              regenerate.add(page.slug);
            }
          }
        }
        break;
      }
      case "renamed":
      case "moved": {
        if (change.oldName !== undefined && change.newName !== undefined) {
          renames.push({ from: change.oldName, to: change.newName });
          // Preserve history: relink references instead of orphaning pages.
          for (const slug of pagesForSymbol(change.oldName)) relink.add(slug);
          for (const slug of pagesForSymbol(change.newName)) regenerate.add(slug);
        }
        break;
      }
      case "deprecated": {
        if (change.newName !== undefined && change.oldName !== undefined) {
          renames.push({ from: change.oldName, to: change.newName });
        }
        for (const symbol of change.symbols ?? [change.oldName ?? ""]) {
          if (symbol === "") continue;
          const owners = pagesForSymbol(symbol);
          if (owners.length > 0) {
            for (const slug of owners) deprecate.add(slug);
          } else {
            // Deprecated API without a page: surface in migration content.
            create.add("migration");
          }
        }
        break;
      }
      case "configuration-changed": {
        for (const page of pages) {
          if (page.kinds.includes("configuration")) regenerate.add(page.slug);
        }
        break;
      }
      case "dependency-changed": {
        for (const page of pages) {
          if (page.kinds.includes("guide") || page.kinds.includes("overview")) {
            regenerate.add(page.slug);
          }
        }
        break;
      }
      case "architecture-changed": {
        navigationChanged = true;
        for (const page of pages) {
          if (page.kinds.includes("architecture")) regenerate.add(page.slug);
        }
        break;
      }
    }
  }

  return {
    regenerate: [...regenerate],
    relink: [...relink],
    deprecate: [...deprecate],
    create: [...create],
    navigationChanged,
    renames,
  };
}

/**
 * Detect renames by comparing two intelligence snapshots.
 * A symbol present before and absent after, with a similar new symbol
 * appearing, is treated as a rename — not a remove + add.
 */
export function detectRenames(
  before: readonly string[],
  after: readonly string[],
): { renamed: { from: string; to: string }[]; added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  const removed = [...beforeSet].filter((s) => !afterSet.has(s));
  const added = [...afterSet].filter((s) => !beforeSet.has(s));

  const renamed: { from: string; to: string }[] = [];
  const unmatchedAdded = new Set(added);

  for (const oldName of removed) {
    const match = findRenameMatch(oldName, unmatchedAdded);
    if (match !== undefined) {
      renamed.push({ from: oldName, to: match });
      unmatchedAdded.delete(match);
    }
  }

  return {
    renamed,
    added: [...unmatchedAdded],
    removed: removed.filter((r) => !renamed.some((rn) => rn.from === r)),
  };
}

/** Deprecation info extracted from an API entry, if any. */
export function extractDeprecation(api: {
  deprecated?: boolean;
  deprecatedInFavorOf?: string;
  name: string;
}): SourceChange | undefined {
  if (api.deprecated !== true) return undefined;
  return {
    kind: "deprecated",
    symbols: [api.name],
    oldName: api.name,
    newName: api.deprecatedInFavorOf,
  };
}

/** Convenience: build a full change list between two project inputs. */
export function diffProjectInputs(
  before: CompilerProjectInput,
  after: CompilerProjectInput,
): SourceChange[] {
  const changes: SourceChange[] = [];
  const beforeApis = new Set((before.apis ?? []).map((a) => a.name));
  const afterApis = new Set((after.apis ?? []).map((a) => a.name));

  const renames = detectRenames([...beforeApis], [...afterApis]);
  for (const r of renames.renamed) {
    changes.push({ kind: "renamed", oldName: r.from, newName: r.to, symbols: [r.to] });
  }
  for (const added of renames.added) {
    changes.push({ kind: "added", symbols: [added] });
  }
  for (const removed of renames.removed) {
    changes.push({ kind: "removed", symbols: [removed] });
  }

  // Signature/behavior changes on shared symbols.
  for (const afterApi of after.apis ?? []) {
    const beforeApi = (before.apis ?? []).find((a) => a.name === afterApi.name);
    if (beforeApi === undefined) continue;
    if (beforeApi.signature !== afterApi.signature) {
      changes.push({
        kind: "signature-changed",
        symbols: [afterApi.name],
      });
    }
    if (!beforeApi.deprecated && afterApi.deprecated) {
      const dep = extractDeprecation(afterApi);
      if (dep !== undefined) changes.push(dep);
    }
  }

  // Config keys.
  const beforeKeys = new Set(before.signals.configKeys ?? []);
  const afterKeys = new Set(after.signals.configKeys ?? []);
  const keysChanged = [...beforeKeys, ...afterKeys].some(
    (k) => beforeKeys.has(k) !== afterKeys.has(k),
  );
  if (keysChanged) changes.push({ kind: "configuration-changed" });

  // Dependencies.
  const sameDeps =
    JSON.stringify([...(before.signals.dependencies ?? [])].sort()) ===
    JSON.stringify([...(after.signals.dependencies ?? [])].sort());
  if (!sameDeps) changes.push({ kind: "dependency-changed" });

  return changes;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function findRenameMatch(oldName: string, candidates: Set<string>): string | undefined {
  const lowerOld = oldName.toLowerCase();
  let best: string | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = renameSimilarity(lowerOld, candidate.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  // Require meaningful similarity to avoid false-positive merges.
  return bestScore >= 0.6 ? best : undefined;
}

/** Cheap similarity: normalized edit distance + shared token bonus. */
function renameSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/(?=[A-Z])|[-_]/));
  const tokensB = new Set(b.split(/(?=[A-Z])|[-_]/));
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  const tokenScore = shared / Math.max(tokensA.size, tokensB.size, 1);
  const distance = levenshtein(a, b);
  const lengthMax = Math.max(a.length, b.length, 1);
  const editScore = 1 - distance / lengthMax;
  return Math.max(tokenScore, editScore * 0.9);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n] ?? Math.max(m, n);
}
