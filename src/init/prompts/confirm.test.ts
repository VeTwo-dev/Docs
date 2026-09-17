import { describe, it, expect } from "vitest";
import { confirmPlan, summarizePlan } from "./confirm.js";
import type { PlanAction } from "../types/plan.js";

function action(
  overrides: Partial<PlanAction> & { path: string; action: PlanAction["action"] },
): PlanAction {
  return {
    reason: "test",
    ownership: "system-generated",
    risk: "none",
    interactive: false,
    kind: "file",
    ...overrides,
  };
}

describe("summarizePlan", () => {
  it("counts actions by kind", () => {
    const plan: readonly PlanAction[] = [
      action({ path: "/a", action: "create" }),
      action({ path: "/b", action: "create" }),
      action({ path: "/c", action: "update" }),
      action({ path: "/d", action: "warn" }),
      action({ path: "/e", action: "merge" }),
      action({ path: "/f", action: "conflict" }),
      action({ path: "/g", action: "skip" }),
    ];
    expect(summarizePlan(plan)).toEqual({
      creates: 2,
      updates: 2,
      merges: 1,
      conflicts: 1,
      skips: 1,
    });
  });

  it("returns zeroes for an empty plan", () => {
    expect(summarizePlan([])).toEqual({
      creates: 0,
      updates: 0,
      merges: 0,
      conflicts: 0,
      skips: 0,
    });
  });
});

describe("confirmPlan", () => {
  const safe: readonly PlanAction[] = [action({ path: "/a", action: "create" })];
  const withConflict: readonly PlanAction[] = [
    action({ path: "/a", action: "create" }),
    action({ path: "/b", action: "conflict", interactive: true }),
  ];

  it("never applies in dry-run mode", async () => {
    expect(await confirmPlan(safe, { mode: "dry-run" })).toBe("abort");
  });

  it("auto mode applies safe plans", async () => {
    expect(await confirmPlan(safe, { mode: "auto" })).toBe("apply");
  });

  it("auto mode downgrades to apply-safe when interactions are required", async () => {
    expect(await confirmPlan(withConflict, { mode: "auto" })).toBe("apply-safe");
  });

  it("interactive mode aborts on 'n'", async () => {
    const decision = await confirmPlan(safe, {
      mode: "interactive",
      ask: async () => "n",
    });
    expect(decision).toBe("abort");
  });

  it("interactive mode applies when the user accepts", async () => {
    const decision = await confirmPlan(safe, {
      mode: "interactive",
      ask: async () => "yes",
    });
    expect(decision).toBe("apply");
  });

  it("interactive mode asks for explicit conflict consent", async () => {
    const questions: string[] = [];
    const decision = await confirmPlan(withConflict, {
      mode: "interactive",
      ask: async (question) => {
        questions.push(question);
        return questions.length === 1 ? "y" : "no";
      },
    });
    expect(decision).toBe("apply-safe");
    expect(questions).toHaveLength(2);
  });

  it("interactive mode applies conflicts when consent is explicit", async () => {
    const decision = await confirmPlan(withConflict, {
      mode: "interactive",
      ask: async () => "yes",
    });
    expect(decision).toBe("apply");
  });

  it("mentions preserved conflicts in the prompt", async () => {
    let asked = "";
    await confirmPlan(withConflict, {
      mode: "interactive",
      ask: async (question) => {
        asked = question;
        return "n";
      },
    });
    expect(asked).toContain("1 conflict");
  });
});
