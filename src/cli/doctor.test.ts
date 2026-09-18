import { describe, it, expect } from "vitest";
import { summarizeDoctorChecks, doctorExitCode, type DoctorCheck } from "./doctor.js";
import { EXIT_CODES } from "../errors/codes.js";

const ok = (label: string): DoctorCheck => ({ label, pass: true, detail: "ok" });
const fail = (label: string, advisory = false): DoctorCheck => ({
  label,
  pass: false,
  detail: "failed",
  ...(advisory ? { advisory: true as const } : {}),
});

describe("summarizeDoctorChecks", () => {
  it("passes cleanly when everything passes", () => {
    const summary = summarizeDoctorChecks([ok("a"), ok("b")]);
    expect(summary).toEqual({
      passed: 2,
      failed: 0,
      blockingFailed: 0,
      advisoryFailed: 0,
      total: 2,
      shouldFail: false,
    });
    expect(doctorExitCode(summary)).toBe(0);
  });

  it("does not fail the run when only advisory checks fail", () => {
    const summary = summarizeDoctorChecks([
      ok("package.json"),
      fail("Git repository", true),
      fail("CHANGELOG", true),
    ]);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.blockingFailed).toBe(0);
    expect(summary.advisoryFailed).toBe(2);
    expect(summary.shouldFail).toBe(false);
    expect(doctorExitCode(summary)).toBe(0);
  });

  it("fails the run when a blocking check fails", () => {
    const summary = summarizeDoctorChecks([
      ok("package.json"),
      fail("package.json"),
      fail("Git repository", true),
    ]);
    expect(summary.blockingFailed).toBe(1);
    expect(summary.advisoryFailed).toBe(1);
    expect(summary.shouldFail).toBe(true);
    expect(doctorExitCode(summary)).toBe(EXIT_CODES.general);
  });

  it("handles empty check lists", () => {
    const summary = summarizeDoctorChecks([]);
    expect(summary.shouldFail).toBe(false);
    expect(doctorExitCode(summary)).toBe(0);
  });
});
