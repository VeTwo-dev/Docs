import { describe, it, expect } from "vitest";
import { MemorySafeFileSystem } from "../filesystem/memory.js";
import {
  buildInitPlan,
  isApplicable,
  requiresConfirmation,
  hasConflicts,
  applicableActions,
} from "./index.js";
import type { PlannerInput, PlannerTemplates } from "./index.js";
import type { WorkspaceConfig, ExistingState } from "../types/workspace.js";

const ROOT = "/project";

const workspace: WorkspaceConfig = {
  output: { directory: "docs", layout: { next: true, markdown: true, static: true } },
  agent: { enabled: true, skill: { path: "agent/skill.md" } },
};

const templates: PlannerTemplates = {
  configContent: "export default defineDocs({});\n",
  configOutputFragment: 'output: { directory: "docs" },',
  configAgentFragment: "agent: { enabled: true },",
  skillContent: "# skill\n<!-- BEGIN project-context -->\nx\n<!-- END project-context -->\n",
  agentReadme: "# agent",
  plansReadme: "# plans",
  markdownReadme: "# md",
  staticReadme: "# static",
  nextScaffold: [["package.json", "{}"]],
};

function existing(overrides: Partial<ExistingState> = {}): ExistingState {
  return {
    configFile: undefined,
    agentDir: false,
    skillFile: undefined,
    outputDir: false,
    nextDir: false,
    mdDir: false,
    staticDir: false,
    alternativeDirs: [],
    ...overrides,
  };
}

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    fs: new MemorySafeFileSystem(),
    root: ROOT,
    workspace,
    existing: existing(),
    manifest: undefined,
    templates,
    ...overrides,
  };
}

describe("buildInitPlan", () => {
  it("plans a fresh workspace with agent and all layouts", () => {
    const fs = new MemorySafeFileSystem();
    const plan = buildInitPlan(input({ fs }));
    const actions = plan.map((a) => a.action);
    expect(actions).toContain("create");
    expect(plan.filter((a) => a.kind === "directory").length).toBeGreaterThan(0);
    expect(plan.some((a) => a.path === `${ROOT}/docs.config.ts`)).toBe(true);
    expect(plan.some((a) => a.path === `${ROOT}/agent/skill.md`)).toBe(true);
    expect(plan.some((a) => a.path === `${ROOT}/docs/md/README.md`)).toBe(true);
    expect(plan.some((a) => a.path === `${ROOT}/docs/next/package.json`)).toBe(true);
    expect(plan.some((a) => a.path === `${ROOT}/.vetwo/docs/manifests/workspace.json`)).toBe(true);
  });

  it("skips an existing config that already has output and agent", () => {
    const fs = new MemorySafeFileSystem();
    fs.writeFile(
      `${ROOT}/docs.config.ts`,
      "export default defineDocs({\n  output: {},\n  agent: {},\n});",
    );
    const plan = buildInitPlan(
      input({ fs, existing: existing({ configFile: `${ROOT}/docs.config.ts` }) }),
    );
    const config = plan.find((a) => a.path === `${ROOT}/docs.config.ts`);
    expect(config?.action).toBe("skip");
  });

  it("merges a config missing the agent section", () => {
    const fs = new MemorySafeFileSystem();
    fs.writeFile(`${ROOT}/docs.config.ts`, "export default defineDocs({ output: {} });");
    const plan = buildInitPlan(
      input({ fs, existing: existing({ configFile: `${ROOT}/docs.config.ts` }) }),
    );
    const config = plan.find((a) => a.path === `${ROOT}/docs.config.ts`);
    expect(config?.action).toBe("merge");
  });

  it("warns when the existing config cannot be merged", () => {
    const fs = new MemorySafeFileSystem();
    fs.writeFile(`${ROOT}/docs.config.ts`, "module.exports = {};");
    const plan = buildInitPlan(
      input({ fs, existing: existing({ configFile: `${ROOT}/docs.config.ts` }) }),
    );
    const config = plan.find((a) => a.path === `${ROOT}/docs.config.ts`);
    expect(config?.action).toBe("warn");
  });

  it("merges an existing generated skill and creates one when absent", () => {
    const fs = new MemorySafeFileSystem();
    fs.writeFile(
      `${ROOT}/agent/skill.md`,
      "# existing\n<!-- vetwo:managed:start project-context -->\nuser\n<!-- vetwo:managed:end project-context -->\n",
    );
    const mergePlan = buildInitPlan(input({ fs }));
    expect(mergePlan.find((a) => a.path === `${ROOT}/agent/skill.md`)?.action).toBe("merge");

    const fs2 = new MemorySafeFileSystem();
    fs2.writeFile(`${ROOT}/agent/skill.md`, "# user skill\n");
    const createPlan = buildInitPlan(input({ fs: fs2 }));
    expect(createPlan.find((a) => a.path === `${ROOT}/agent/skill.md`)?.action).toBe("skip");
  });

  it("preserves existing agent readmes and creates missing plans readme", () => {
    const fs = new MemorySafeFileSystem();
    fs.writeFile(`${ROOT}/agent/README.md`, "# existing");
    const plan = buildInitPlan(input({ fs }));
    expect(plan.find((a) => a.path === `${ROOT}/agent/README.md`)?.action).toBe("skip");
    expect(plan.find((a) => a.path === `${ROOT}/agent/plans/README.md`)?.action).toBe("create");
  });

  it("reports alternative documentation directories as warnings", () => {
    const plan = buildInitPlan(input({ existing: existing({ alternativeDirs: ["wiki"] }) }));
    const warn = plan.find((a) => a.path === `${ROOT}/wiki`);
    expect(warn?.action).toBe("warn");
  });

  it("supports a disabled agent workspace", () => {
    const plan = buildInitPlan(
      input({
        workspace: { ...workspace, agent: { enabled: false, skill: { path: "agent/skill.md" } } },
      }),
    );
    expect(plan.some((a) => a.path === `${ROOT}/agent/skill.md`)).toBe(false);
  });

  it("supports markdown-only output layout", () => {
    const plan = buildInitPlan(
      input({
        workspace: {
          ...workspace,
          output: { directory: "docs", layout: { next: false, markdown: true, static: false } },
        },
      }),
    );
    expect(plan.some((a) => a.path.includes("/next/"))).toBe(false);
    expect(plan.some((a) => a.path === `${ROOT}/docs/md/README.md`)).toBe(true);
  });
});

describe("plan helpers", () => {
  it("isApplicable recognises create/update/merge", () => {
    expect(isApplicable("create")).toBe(true);
    expect(isApplicable("update")).toBe(true);
    expect(isApplicable("merge")).toBe(true);
    expect(isApplicable("skip")).toBe(false);
    expect(isApplicable("conflict")).toBe(false);
    expect(isApplicable("warn")).toBe(false);
  });

  it("requiresConfirmation and hasConflicts inspect interactive/conflict actions", () => {
    const safe = [
      {
        path: "/a",
        action: "create",
        reason: "",
        ownership: "system-generated",
        risk: "none",
        interactive: false,
        kind: "file",
      },
    ];
    const conflicting = [{ ...safe[0]!, action: "conflict", interactive: true }];
    expect(requiresConfirmation(safe)).toBe(false);
    expect(requiresConfirmation(conflicting)).toBe(true);
    expect(hasConflicts(safe)).toBe(false);
    expect(hasConflicts(conflicting)).toBe(true);
  });

  it("applicableActions filters to applicable actions", () => {
    const plan = [
      {
        path: "/a",
        action: "create",
        reason: "",
        ownership: "system-generated",
        risk: "none",
        interactive: false,
        kind: "file",
      },
      {
        path: "/b",
        action: "skip",
        reason: "",
        ownership: "system-generated",
        risk: "none",
        interactive: false,
        kind: "file",
      },
    ];
    expect(applicableActions(plan)).toHaveLength(1);
  });
});
