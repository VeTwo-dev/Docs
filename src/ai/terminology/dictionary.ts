/**
 * AI Terminology Model.
 *
 * Detects and maintains a project-specific terminology dictionary.
 * Ensures the AI uses canonical names consistently and does not
 * hallucinate terminology that doesn't exist in the project.
 */

import type { AITerminologyEntry } from "../types.js";

/** A detected terminology entry with source evidence. */
export interface DetectedTerminology extends AITerminologyEntry {
  /** Where this term was detected: `"symbol"`, `"config"`, `"package"`, `"file"`, `"documentation"`. */
  readonly source: string;
  /** Number of occurrences found. */
  readonly occurrences: number;
}

/**
 * Detect terminology from project intelligence data.
 */
export function detectTerminology(input: {
  /** Symbol names from the symbol engine. */
  symbols?: readonly string[];
  /** Package names from dependencies. */
  packages?: readonly string[];
  /** Config keys from the configuration system. */
  configKeys?: readonly string[];
  /** File names that represent concepts. */
  fileNames?: readonly string[];
  /** Existing documentation terms. */
  docTerms?: readonly string[];
}): DetectedTerminology[] {
  const entries = new Map<string, DetectedTerminology>();

  // Symbol names → API terminology
  for (const name of input.symbols ?? []) {
    const existing = entries.get(name);
    if (existing !== undefined) {
      entries.set(name, { ...existing, occurrences: existing.occurrences + 1 });
    } else {
      entries.set(name, {
        canonical: name,
        category: "api",
        source: "symbol",
        occurrences: 1,
      });
    }
  }

  // Package names → product/framework terminology
  for (const pkg of input.packages ?? []) {
    const name = pkg.replace(/^@[^/]+\//, "");
    entries.set(name, {
      canonical: name,
      category: "framework",
      preserveInTranslation: true,
      source: "package",
      occurrences: 1,
    });
  }

  // Config keys → configuration terminology
  for (const key of input.configKeys ?? []) {
    entries.set(key, {
      canonical: key,
      category: "config",
      preserveInTranslation: true,
      source: "config",
      occurrences: 1,
    });
  }

  return [...entries.values()].sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Build a terminology dictionary for a project.
 * Combines detected terms with user-provided custom terms.
 */
export function buildTerminologyDictionary(
  detected: DetectedTerminology[],
  custom?: readonly AITerminologyEntry[],
): AITerminologyEntry[] {
  const dictionary = new Map<string, AITerminologyEntry>();

  // Custom terms take precedence
  for (const entry of custom ?? []) {
    dictionary.set(entry.canonical, entry);
  }

  // Add detected terms
  for (const entry of detected) {
    if (!dictionary.has(entry.canonical)) {
      dictionary.set(entry.canonical, {
        canonical: entry.canonical,
        category: entry.category,
        preserveInTranslation: entry.preserveInTranslation,
      });
    }
  }

  return [...dictionary.values()];
}

/**
 * Validate that a set of terms used in generated content matches the
 * terminology dictionary. Returns terms that are not in the dictionary.
 */
export function validateTerminology(
  usedTerms: readonly string[],
  dictionary: readonly AITerminologyEntry[],
): { valid: string[]; unknown: string[]; suggestions: Map<string, string> } {
  const knownTerms = new Set<string>();
  const aliasMap = new Map<string, string>();

  for (const entry of dictionary.values()) {
    knownTerms.add(entry.canonical.toLowerCase());
    for (const alias of entry.aliases ?? []) {
      aliasMap.set(alias.toLowerCase(), entry.canonical);
    }
  }

  const valid: string[] = [];
  const unknown: string[] = [];
  const suggestions = new Map<string, string>();

  for (const term of usedTerms) {
    const lower = term.toLowerCase();
    if (knownTerms.has(lower)) {
      valid.push(term);
    } else {
      const suggestion = aliasMap.get(lower);
      if (suggestion !== undefined) {
        suggestions.set(term, suggestion);
      } else {
        unknown.push(term);
      }
    }
  }

  return { valid, unknown, suggestions };
}
