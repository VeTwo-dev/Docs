import type { SafeFileSystem } from "../filesystem/interface.js";
import type { PlanAction, Ownership, PathKind, InitAction } from "../types/plan.js";
import type { WorkspaceConfig, ExistingState } from "../types/workspace.js";
import type { WorkspaceManifest } from "../types/manifest.js";
import { manifestPathFor } from "../manifests/index.js";
import { classifyPath, resolveConflict } from "../safety/index.js";
import { detectConfigSections, mergeConfigContent } from "../merge/index.js";
import { hasManagedSections, SKILL_ID } from "../templates/skill.js";
import type { ScaffoldFile } from "../templates/next.js";

/** Precomputed template contents handed to the planner. */
export interface PlannerTemplates {
  readonly configContent: string;
  readonly configOutputFragment: string;
  readonly configAgentFragment: string;
  readonly skillContent: string;
  readonly agentReadme: string;
  readonly plansReadme: string;
  readonly markdownReadme: string;
  readonly staticReadme: string;
  readonly nextScaffold: readonly ScaffoldFile[];
}

/** Everything the planner needs to produce an initialization plan. */
export interface PlannerInput {
  readonly fs: SafeFileSystem;
  readonly root: string;
  readonly workspace: WorkspaceConfig;
  readonly existing: ExistingState;
  readonly manifest: WorkspaceManifest | undefined;
  readonly templates: PlannerTemplates;
}

const MANAGED_OWNERSHIP: Ownership = "system-managed";
const GENERATED_OWNERSHIP: Ownership = "system-generated";

/**
 * Builds the complete initialization plan. Every path is classified and run
 * through conflict analysis — no action that could destroy user content is
 * ever emitted without the `conflict` marker.
 */
export function buildInitPlan(input: PlannerInput): readonly PlanAction[] {
  const { fs, root, workspace, existing, manifest, templates } = input;
  const plan: PlanAction[] = [];
  const relPath = (rel: string): string => fs.join(root, rel);

  const add = (
    rel: string,
    desired: InitAction,
    kind: PathKind,
    options: { template?: string; ownershipOverride?: Ownership } = {},
  ): void => {
    const abs = relPath(rel);
    const classified =
      options.ownershipOverride ??
      (kind === "directory"
        ? fs.exists(abs)
          ? MANAGED_OWNERSHIP
          : GENERATED_OWNERSHIP
        : classifyPath({
            fs,
            root,
            path: abs,
            manifest,
            expectedTemplate: options.template,
          }).ownership);
    const resolved = resolveConflict(fs, {
      path: abs,
      desiredAction: desired,
      directory: kind === "directory",
      ownership: classified,
    });
    plan.push({
      path: abs,
      action: resolved.action,
      reason: resolved.reason,
      ownership: classified,
      risk: resolved.risk,
      interactive: resolved.interactive,
      kind,
    });
  };

  // ── 1. Configuration ──────────────────────────────────────────────────
  if (existing.configFile === undefined) {
    add("docs.config.ts", "create", "file", {
      template: templates.configContent,
      ownershipOverride: GENERATED_OWNERSHIP,
    });
  } else {
    const content = fs.readFile(existing.configFile);
    const sections = detectConfigSections(content);
    if (sections.hasOutput && sections.hasAgent) {
      add(fs.relative(root, existing.configFile), "skip", "file");
    } else {
      const merged = mergeConfigContent(content, {
        output: templates.configOutputFragment,
        agent: templates.configAgentFragment,
      });
      if (merged !== undefined) {
        add(fs.relative(root, existing.configFile), "merge", "file", {
          template: merged,
          ownershipOverride: GENERATED_OWNERSHIP,
        });
      } else {
        plan.push({
          path: existing.configFile,
          action: "warn",
          reason: "Configuration exists but cannot be safely merged",
          ownership: "user-authored",
          risk: "low",
          interactive: false,
          kind: "file",
        });
      }
    }
  }

  // ── 2. Agent workspace ────────────────────────────────────────────────
  if (workspace.agent.enabled) {
    const agentDir = "agent";
    if (!existing.agentDir) {
      add(agentDir, "create", "directory");
    }
    for (const sub of ["plans", "briefs", "context", "generated", "reports"]) {
      add(`${agentDir}/${sub}`, "create", "directory");
    }

    const skillRel = workspace.agent.skill.path;
    const skillAbs = relPath(skillRel);
    if (!fs.exists(skillAbs)) {
      add(skillRel, "create", "file", {
        template: templates.skillContent,
        ownershipOverride: GENERATED_OWNERSHIP,
      });
    } else {
      const content = fs.readFile(skillAbs);
      const isGenerated = hasManagedSections(content) || content.includes(`skill: ${SKILL_ID}`);
      if (isGenerated) {
        add(skillRel, "merge", "file", { ownershipOverride: GENERATED_OWNERSHIP });
      } else {
        add(skillRel, "create", "file", {
          template: templates.skillContent,
          ownershipOverride: GENERATED_OWNERSHIP,
        });
      }
    }

    if (!fs.exists(relPath(`${agentDir}/README.md`))) {
      add(`${agentDir}/README.md`, "create", "file", {
        template: templates.agentReadme,
        ownershipOverride: GENERATED_OWNERSHIP,
      });
    } else {
      add(`${agentDir}/README.md`, "skip", "file");
    }
    if (!fs.exists(relPath(`${agentDir}/plans/README.md`))) {
      add(`${agentDir}/plans/README.md`, "create", "file", {
        template: templates.plansReadme,
        ownershipOverride: GENERATED_OWNERSHIP,
      });
    }
  }

  // ── 3. Output workspace ───────────────────────────────────────────────
  const output = workspace.output;
  const outDir = output.directory;
  if (!existing.outputDir) {
    add(outDir, "create", "directory");
  }

  if (output.layout.next) {
    add(`${outDir}/next`, "create", "directory");
    add(`${outDir}/next/app`, "create", "directory");
    for (const [file, content] of templates.nextScaffold) {
      add(`${outDir}/next/${file}`, "create", "file", {
        template: content,
        ownershipOverride: GENERATED_OWNERSHIP,
      });
    }
  }

  if (output.layout.markdown) {
    add(`${outDir}/md`, "create", "directory");
    add(`${outDir}/md/README.md`, "create", "file", {
      template: templates.markdownReadme,
      ownershipOverride: GENERATED_OWNERSHIP,
    });
  }

  if (output.layout.static) {
    add(`${outDir}/static`, "create", "directory");
    add(`${outDir}/static/README.md`, "create", "file", {
      template: templates.staticReadme,
      ownershipOverride: GENERATED_OWNERSHIP,
    });
  }

  // Existing alternative documentation directories that will not be touched.
  for (const alt of existing.alternativeDirs) {
    plan.push({
      path: relPath(alt),
      action: "warn",
      reason: "Existing documentation directory preserved; not touched by init",
      ownership: "user-authored",
      risk: "low",
      interactive: false,
      kind: "directory",
    });
  }

  // ── 4. Workspace manifest ─────────────────────────────────────────────
  add(fs.relative(root, manifestPathFor(fs, root)), "update", "file", {
    ownershipOverride: MANAGED_OWNERSHIP,
  });

  return plan;
}

/** Whether an action should be applied (create/update/merge). */
export function isApplicable(action: PlanAction["action"]): boolean {
  return action === "create" || action === "update" || action === "merge";
}

/** Whether the plan requires an interactive decision. */
export function requiresConfirmation(plan: readonly PlanAction[]): boolean {
  return plan.some((a) => a.interactive);
}

/** Whether any action would overwrite user-owned content. */
export function hasConflicts(plan: readonly PlanAction[]): boolean {
  return plan.some((a) => a.action === "conflict");
}

/** Filter plan to actions that would actually change the filesystem. */
export function applicableActions(plan: readonly PlanAction[]): readonly PlanAction[] {
  return plan.filter((a) => isApplicable(a.action));
}
