/**
 * Anti-Hallucination: Claim Validation.
 *
 * Validates that AI-generated claims are grounded in project evidence.
 * Claims are checked against the knowledge graph, symbol extraction,
 * reference resolution, and configuration data.
 */

import type { AIDocumentationClaim, AIEvidenceReference } from "../types.js";

/** Result of validating a single claim. */
export interface ClaimValidationResult {
  /** The original claim. */
  readonly claim: AIDocumentationClaim;
  /** Whether the claim is valid. */
  readonly valid: boolean;
  /** Validation status: `"verified"`, `"inferred"`, `"unsupported"`, `"contradicted"`. */
  readonly status: "verified" | "inferred" | "unsupported" | "contradicted";
  /** Reason for the validation result. */
  readonly reason: string;
  /** Supporting evidence found. */
  readonly supportingEvidence?: readonly AIEvidenceReference[];
}

/** Evidence sources for validation. */
export interface ValidationEvidence {
  /** Known symbol names. */
  readonly symbols?: readonly string[];
  /** Known module/file paths. */
  readonly files?: readonly string[];
  /** Known config keys. */
  readonly configKeys?: readonly string[];
  /** Known package names. */
  readonly packages?: readonly string[];
  /** Known graph edges (from→to). */
  readonly graphEdges?: readonly { from: string; to: string; kind: string }[];
  /** Known API signatures. */
  readonly apiSignatures?: readonly {
    name: string;
    parameters?: readonly string[];
    returnType?: string;
  }[];
}

/**
 * Validate a single claim against project evidence.
 */
export function validateClaim(
  claim: AIDocumentationClaim,
  evidence: ValidationEvidence,
): ClaimValidationResult {
  const text = claim.text.toLowerCase();
  const supportingEvidence: AIEvidenceReference[] = [];
  let valid = true;
  let status: ClaimValidationResult["status"] = "verified";
  let reason = "Claim is supported by project evidence.";

  // Check if claim references a symbol
  const symbolRefs = extractSymbolReferences(text);
  for (const ref of symbolRefs) {
    const found = evidence.symbols?.some((s) => s.toLowerCase() === ref.toLowerCase());
    if (found) {
      supportingEvidence.push({ kind: "symbol", value: ref, confidence: "verified" });
    } else {
      // Check if it's a known alias or common name
      const inferred = evidence.symbols?.some((s) => s.toLowerCase().includes(ref.toLowerCase()));
      if (inferred) {
        supportingEvidence.push({ kind: "symbol", value: ref, confidence: "inferred" });
      } else {
        valid = false;
        status = "unsupported";
        reason = `Symbol "${ref}" not found in project.`;
      }
    }
  }

  // Check if claim references a file
  const fileRefs = extractFileReferences(text);
  for (const ref of fileRefs) {
    const found = evidence.files?.some((f) => f.includes(ref));
    if (found) {
      supportingEvidence.push({ kind: "file", value: ref, confidence: "verified" });
    }
  }

  // Check if claim references a config key
  const configRefs = extractConfigReferences(text);
  for (const ref of configRefs) {
    const found = evidence.configKeys?.some((k) => k.toLowerCase() === ref.toLowerCase());
    if (found) {
      supportingEvidence.push({ kind: "config", value: ref, confidence: "verified" });
    }
  }

  // If the claim has explicit evidence, trust it (but validate)
  if (claim.evidence.length > 0 && supportingEvidence.length === 0) {
    // The provider asserted evidence — verify it
    for (const ev of claim.evidence) {
      if (ev.kind === "symbol") {
        const found = evidence.symbols?.some((s) => s === ev.value);
        if (found) {
          supportingEvidence.push({ ...ev, confidence: "verified" });
        } else {
          valid = false;
          status = "contradicted";
          reason = `Claimed evidence "${ev.value}" not found.`;
        }
      }
    }
  }

  if (valid && supportingEvidence.length === 0) {
    status = "inferred";
    reason = "No direct evidence found; claim may be inferential.";
  }

  return {
    claim: { ...claim, validated: valid, validationError: valid ? undefined : reason },
    valid,
    status,
    reason,
    supportingEvidence,
  };
}

/**
 * Validate all claims in a set of generated pages.
 */
export function validateClaims(
  claims: readonly AIDocumentationClaim[],
  evidence: ValidationEvidence,
): ClaimValidationResult[] {
  return claims.map((claim) => validateClaim(claim, evidence));
}

/**
 * Get a summary of claim validation results.
 */
export function summarizeClaimValidation(results: readonly ClaimValidationResult[]): {
  total: number;
  verified: number;
  inferred: number;
  unsupported: number;
  contradicted: number;
  validationRate: number;
} {
  const total = results.length;
  const verified = results.filter((r) => r.status === "verified").length;
  const inferred = results.filter((r) => r.status === "inferred").length;
  const unsupported = results.filter((r) => r.status === "unsupported").length;
  const contradicted = results.filter((r) => r.status === "contradicted").length;
  return {
    total,
    verified,
    inferred,
    unsupported,
    contradicted,
    validationRate: total > 0 ? (verified + inferred) / total : 1,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function extractSymbolReferences(text: string): string[] {
  // Match patterns like "createUser()" or "the Foo class" or "the Bar interface"
  const refs: string[] = [];
  const callPattern = /(\w+)\(\)/g;
  const classPattern = /(?:the|a|an)\s+(\w+)\s+(?:class|interface|type|function|method)/gi;

  let match = callPattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) refs.push(match[1]);
    match = callPattern.exec(text);
  }

  match = classPattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) refs.push(match[1]);
    match = classPattern.exec(text);
  }

  return [...new Set(refs)];
}

function extractFileReferences(text: string): string[] {
  const refs: string[] = [];
  const pattern = /(?:`([^`]+\.(?:ts|js|tsx|jsx|json|yaml|yml))`)/g;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) refs.push(match[1]);
    match = pattern.exec(text);
  }
  return refs;
}

function extractConfigReferences(text: string): string[] {
  const refs: string[] = [];
  const pattern = /(?:`([^`]+)`)\s+(?:option|setting|key|config)/gi;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) refs.push(match[1]);
    match = pattern.exec(text);
  }
  return refs;
}
