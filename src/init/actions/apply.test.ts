import { describe, it, expect, beforeEach } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import { applyPlan } from "./apply.js";
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

describe("applyPlan", () => {
  let fs: MemorySafeFileSystem;
  beforeEach(() => {
    fs = new MemorySafeFileSystem();
  });

  it("creates directories and files", () => {
    const plan: readonly PlanAction[] = [
      action({ path: "/p/dir", action: "create", kind: "directory" }),
      action({ path: "/p/file.txt", action: "create" }),
    ];
    const result = applyPlan(plan, {
      fs,
      files: new Map([["/p/file.txt", "content"]]),
      dryRun: false,
    });
    expect(fs.isDirectory("/p/dir")).toBe(true);
    expect(fs.readFile("/p/file.txt")).toBe("content");
    expect(result.created).toEqual(["/p/dir", "/p/file.txt"]);
  });

  it("preserves a target that appeared between planning and applying", () => {
    fs.writeFile("/p/file.txt", "existing");
    const plan: readonly PlanAction[] = [action({ path: "/p/file.txt", action: "create" })];
    const result = applyPlan(plan, { fs, files: new Map(), dryRun: false });
    expect(result.skipped).toContain("/p/file.txt");
    expect(result.created).toHaveLength(0);
    expect(fs.readFile("/p/file.txt")).toBe("existing");
  });

  it("records errors when safe ops fail", () => {
    fs.failOn(/fail/);
    const plan: readonly PlanAction[] = [action({ path: "/p/fail.txt", action: "create" })];
    const result = applyPlan(plan, { fs, files: new Map(), dryRun: false });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("updates system-managed files and skips on failure", () => {
    fs.writeFile("/p/upd.txt", "old");
    const plan: readonly PlanAction[] = [
      action({ path: "/p/upd.txt", action: "update" }),
      action({ path: "/p/wont.txt", action: "update" }),
    ];
    fs.failOn(/wont/);
    const result = applyPlan(plan, {
      fs,
      files: new Map([
        ["/p/upd.txt", "new"],
        ["/p/wont.txt", "x"],
      ]),
      dryRun: false,
    });
    expect(result.updated).toEqual(["/p/upd.txt"]);
    expect(fs.readFile("/p/upd.txt")).toBe("new");
    expect(result.skipped).toContain("/p/wont.txt");
  });

  it("merges content and reports missing merged content", () => {
    const plan: readonly PlanAction[] = [
      action({ path: "/p/merge.txt", action: "merge" }),
      action({ path: "/p/nocontent.txt", action: "merge" }),
    ];
    const result = applyPlan(plan, {
      fs,
      files: new Map([["/p/merge.txt", "merged"]]),
      dryRun: false,
    });
    expect(result.merged).toEqual(["/p/merge.txt"]);
    expect(fs.readFile("/p/merge.txt")).toBe("merged");
    expect(result.skipped).toContain("/p/nocontent.txt");
  });

  it("reports conflicts and skip actions as preserved when present", () => {
    fs.writeFile("/p/exists.txt", "user");
    const plan: readonly PlanAction[] = [
      action({ path: "/p/conflict.txt", action: "conflict" }),
      action({ path: "/p/exists.txt", action: "skip" }),
      action({ path: "/p/missing.txt", action: "skip" }),
      action({ path: "/p/warn.txt", action: "warn" }),
    ];
    const result = applyPlan(plan, { fs, files: new Map(), dryRun: false });
    expect(result.conflicts).toEqual(["/p/conflict.txt"]);
    expect(result.preserved).toEqual(["/p/exists.txt"]);
    expect(result.skipped).toEqual(["/p/missing.txt"]);
  });

  it("records nothing when an unhandled action is encountered", () => {
    const unknown = {
      ...action({ path: "/p/x.txt", action: "create" }),
      action: "mystery",
    } as PlanAction;
    const result = applyPlan([unknown], { fs, files: new Map(), dryRun: false });
    expect(result.created).toHaveLength(0);
  });

  it("records a dry run without touching the filesystem", () => {
    const plan: readonly PlanAction[] = [
      action({ path: "/p/dir", action: "create", kind: "directory" }),
      action({ path: "/p/file.txt", action: "create" }),
      action({ path: "/p/upd.txt", action: "update" }),
      action({ path: "/p/merge.txt", action: "merge" }),
    ];
    const result = applyPlan(plan, {
      fs,
      files: new Map([
        ["/p/file.txt", "c"],
        ["/p/upd.txt", "u"],
        ["/p/merge.txt", "m"],
      ]),
      dryRun: true,
    });
    expect(result.created).toHaveLength(2);
    expect(result.updated).toEqual(["/p/upd.txt"]);
    expect(result.merged).toEqual(["/p/merge.txt"]);
    expect(fs.exists("/p/file.txt")).toBe(false);
    expect(fs.exists("/p/dir")).toBe(false);
  });
});
