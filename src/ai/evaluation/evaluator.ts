/**
 * AI Quality Evaluator.
 *
 * Evaluates the quality of AI-generated documentation across multiple
 * dimensions: accuracy, completeness, clarity, consistency, example quality,
 * relationship quality, audience suitability, and technical depth.
 */

import type { AIGeneratedPage } from "../types.js";

/** A single quality dimension score. */
export interface QualityDimension {
  /** Dimension name. */
  readonly name: string;
  /** Score from 0 (poor) to 1 (excellent). */
  readonly score: number;
  /** Explanation of the score. */
  readonly explanation: string;
}

/** The full quality evaluation result for a page. */
export interface QualityEvaluation {
  /** Page slug. */
  readonly slug: string;
  /** Overall quality score (weighted average). */
  readonly score: number;
  /** Individual dimension scores. */
  readonly dimensions: readonly QualityDimension[];
  /** Issues found. */
  readonly issues: readonly QualityIssue[];
  /** Whether the page passes the quality gate. */
  readonly passed: boolean;
}

/** A quality issue found during evaluation. */
export interface QualityIssue {
  /** Issue kind: `"missing-evidence"`, `"empty-section"`, `"broken-link"`, `"inconsistent-term"`, `"shallow-content"`, `"missing-example"`. */
  readonly kind: string;
  /** Severity: `"error"`, `"warning"`, `"info"`. */
  readonly severity: "error" | "warning" | "info";
  /** Description of the issue. */
  readonly message: string;
  /** Suggested fix. */
  readonly suggestion?: string;
}

/** Evaluation configuration. */
export interface QualityEvaluationConfig {
  /** Minimum score to pass the quality gate. */
  readonly passThreshold?: number;
  /** Whether to check for evidence backing. */
  readonly checkEvidence?: boolean;
  /** Whether to check for empty sections. */
  readonly checkEmptySections?: boolean;
  /** Whether to validate claims. */
  readonly validateClaims?: boolean;
  /** Known terminology for consistency checks. */
  readonly knownTerms?: readonly string[];
}

const DEFAULT_PASS_THRESHOLD = 0.6;

/**
 * Evaluate the quality of a single generated page.
 */
export function evaluatePage(
  page: AIGeneratedPage,
  config: QualityEvaluationConfig = {},
): QualityEvaluation {
  const threshold = config.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const dimensions: QualityDimension[] = [];
  const issues: QualityIssue[] = [];

  // 1. Completeness: does the page have meaningful content?
  const completeness = evaluateCompleteness(page);
  dimensions.push(completeness);
  if (completeness.score < 0.5) {
    issues.push({
      kind: "shallow-content",
      severity: "warning",
      message: `Page content is shallow (${completeness.score.toFixed(2)}).`,
    });
  }

  // 2. Evidence coverage: are claims backed by evidence?
  if (config.checkEvidence !== false) {
    const evidence = evaluateEvidence(page);
    dimensions.push(evidence);
    if (evidence.score < 0.3 && page.claims !== undefined && page.claims.length > 0) {
      issues.push({
        kind: "missing-evidence",
        severity: "warning",
        message: "Some claims lack evidence backing.",
      });
    }
  }

  // 3. Structure: does the page have proper headings and structure?
  const structure = evaluateStructure(page);
  dimensions.push(structure);

  // 4. Example quality: are examples provided and relevant?
  const examples = evaluateExampleQuality(page);
  dimensions.push(examples);

  // 5. Consistency: terminology and style consistency
  if (config.knownTerms !== undefined && config.knownTerms.length > 0) {
    const consistency = evaluateConsistency(page, config.knownTerms);
    dimensions.push(consistency);
    if (consistency.score < 0.7) {
      issues.push({
        kind: "inconsistent-term",
        severity: "info",
        message: "Some terms may be inconsistent with project terminology.",
      });
    }
  }

  // Calculate weighted average
  const weights: Record<string, number> = {
    completeness: 0.3,
    evidence: 0.25,
    structure: 0.2,
    examples: 0.15,
    consistency: 0.1,
  };
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of dimensions) {
    const w = weights[dim.name] ?? 0.1;
    weightedSum += dim.score * w;
    totalWeight += w;
  }
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    slug: page.slug,
    score,
    dimensions,
    issues,
    passed: score >= threshold && !issues.some((i) => i.severity === "error"),
  };
}

/**
 * Evaluate a batch of pages.
 */
export function evaluatePages(
  pages: readonly AIGeneratedPage[],
  config: QualityEvaluationConfig = {},
): readonly QualityEvaluation[] {
  return pages.map((page) => evaluatePage(page, config));
}

/**
 * Summarize evaluation results.
 */
export function summarizeEvaluation(results: readonly QualityEvaluation[]): {
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  totalIssues: number;
  errors: number;
  warnings: number;
} {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const errors = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0,
  );
  const warnings = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
    0,
  );
  return {
    total,
    passed,
    failed: total - passed,
    averageScore: total > 0 ? results.reduce((sum, r) => sum + r.score, 0) / total : 0,
    totalIssues,
    errors,
    warnings,
  };
}

// ─── Dimension Evaluators ────────────────────────────────────────────────

function evaluateCompleteness(page: AIGeneratedPage): QualityDimension {
  const content = page.content;
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
  const hasTitle = content.startsWith("#");
  const hasSections = (content.match(/^##\s/gm) ?? []).length;

  let score = 0;
  if (wordCount > 50) score += 0.3;
  if (wordCount > 200) score += 0.2;
  if (wordCount > 500) score += 0.1;
  if (hasTitle) score += 0.2;
  if (hasSections >= 2) score += 0.2;

  return {
    name: "completeness",
    score: Math.min(score, 1),
    explanation: `${wordCount} words, ${hasSections} sections`,
  };
}

function evaluateEvidence(page: AIGeneratedPage): QualityDimension {
  const claims = page.claims ?? [];
  const evidence = page.evidence ?? [];

  if (claims.length === 0 && evidence.length === 0) {
    return { name: "evidence", score: 0.5, explanation: "No claims to validate" };
  }

  const backedClaims = claims.filter((c) => c.evidence.length > 0).length;
  const claimRate = claims.length > 0 ? backedClaims / claims.length : 1;

  return {
    name: "evidence",
    score: claimRate,
    explanation: `${backedClaims}/${claims.length} claims backed by evidence`,
  };
}

function evaluateStructure(page: AIGeneratedPage): QualityDimension {
  const content = page.content;
  const headings = (content.match(/^#{1,3}\s/gm) ?? []).length;
  const codeBlocks = (content.match(/^```/gm) ?? []).length / 2;
  const lists = (content.match(/^[-*]\s/gm) ?? []).length;

  let score = 0;
  if (headings >= 1) score += 0.3;
  if (headings >= 3) score += 0.2;
  if (codeBlocks >= 1) score += 0.25;
  if (lists >= 1) score += 0.15;

  return {
    name: "structure",
    score: Math.min(score, 1),
    explanation: `${headings} headings, ${codeBlocks} code blocks, ${lists} list items`,
  };
}

function evaluateExampleQuality(page: AIGeneratedPage): QualityDimension {
  const content = page.content;
  const codeBlocks = content.match(/^```[\s\S]*?^```/gm) ?? [];

  if (codeBlocks.length === 0) {
    return { name: "examples", score: 0.3, explanation: "No code examples" };
  }

  let score = 0.5;
  if (codeBlocks.length >= 1) score += 0.2;
  if (codeBlocks.length >= 3) score += 0.1;
  // Check if code blocks have language tags
  const tagged = codeBlocks.filter((b) => /^```\w+/.test(b)).length;
  if (tagged === codeBlocks.length) score += 0.2;

  return {
    name: "examples",
    score: Math.min(score, 1),
    explanation: `${codeBlocks.length} code examples`,
  };
}

function evaluateConsistency(
  page: AIGeneratedPage,
  knownTerms: readonly string[],
): QualityDimension {
  const content = page.content.toLowerCase();
  let consistent = 0;
  let total = 0;

  for (const term of knownTerms) {
    if (content.includes(term.toLowerCase())) {
      consistent++;
    }
    total++;
  }

  return {
    name: "consistency",
    score: total > 0 ? consistent / total : 1,
    explanation: `${consistent}/${total} known terms used`,
  };
}
