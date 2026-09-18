/**
 * Doctor Check Model (Phase 22.4).
 *
 * Pure summary/exit semantics for `docs doctor`: blocking failures fail the
 * run, advisory failures (git absence, missing CHANGELOG) warn only.
 * Kept in a dependency-free module so the logic is unit-testable without
 * importing the full CLI graph.
 */

import { EXIT_CODES } from "../errors/codes.js";

/** A single documentation health check result. */
export interface DoctorCheck {
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
  /** Advisory failures warn but never fail the run (e.g. missing git). */
  readonly advisory?: boolean;
}

/** Aggregated doctor outcome. */
export interface DoctorSummary {
  readonly passed: number;
  readonly failed: number;
  readonly blockingFailed: number;
  readonly advisoryFailed: number;
  readonly total: number;
  /** Whether the run must exit non-zero. */
  readonly shouldFail: boolean;
}

/** Aggregate check results into an exit decision. Pure and deterministic. */
export function summarizeDoctorChecks(checks: readonly DoctorCheck[]): DoctorSummary {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);
  const blockingFailed = failed.filter((c) => c.advisory !== true).length;
  const advisoryFailed = failed.filter((c) => c.advisory === true).length;
  return {
    passed,
    failed: failed.length,
    blockingFailed,
    advisoryFailed,
    total: checks.length,
    shouldFail: blockingFailed > 0,
  };
}

/** Exit code for a doctor summary (0 when only advisories fail). */
export function doctorExitCode(summary: DoctorSummary): number {
  return summary.shouldFail ? EXIT_CODES.general : 0;
}
