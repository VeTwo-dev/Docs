import { createLoggerSync } from "../../logger/index.js";
import { NodeSafeFileSystem } from "../filesystem/index.js";
import type { SafeFileSystem } from "../filesystem/interface.js";
import type { InitOptions, InitMode, InitLayout } from "../types/options.js";
import type { WorkspaceConfig, ExistingState } from "../types/workspace.js";
import type { InitResult } from "../types/result.js";
import { readManifest, manifestPathFor, mergeManifest } from "../manifests/index.js";
import { createManifest } from "../manifests/io.js";
import { SKILL_SCHEMA_VERSION } from "../types/manifest.js";
import type { WorkspaceManifest, ManifestFileEntry } from "../types/manifest.js";
import {
  buildSkillContent,
  buildConfigContent,
  buildAgentReadme,
  buildPlansReadme,
  buildMarkdownReadme,
  buildStaticReadme,
  buildNextScaffold,
} from "../templates/index.js";
import { mergeSkillContent, mergeConfigContent } from "../merge/index.js";
import { buildInitPlan, requiresConfirmation } from "../planner/index.js";
import { applyPlan } from "../actions/index.js";
import { confirmPlan } from "../prompts/index.js";
import { validateWorkspace } from "../diagnostics/index.js";
import { buildInitResult, printInitReport } from "../diagnostics/index.js";
import {
  resolveProjectRoot,
  detectProjectInfo,
  findConfigFile,
  ALTERNATIVE_DOC_DIRS,
} from "./detect.js";
import { extractWorkspaceConfig } from "./config-source.js";
import { createDocsStateManager } from "../../state/manager.js";
import { ensureStateIgnored } from "../../state/gitignore.js";
import { planStateChanges } from "../../state/plan.js";
import { extname } from "node:path";
import type { PlanAction, Ownership } from "../types/plan.js";

const DEFAULT_OUTPUT_DIRECTORY = "docs";

/**
 * Initializes a complete documentation workspace.
 *
 * Safe, idempotent, configuration-aware. Detects the project and existing
 * workspace, builds a typed plan, classifies every path's ownership, and
 * applies only safe non-destructive actions. Existing user content is never
 * overwritten.
 *
 * @param options - Initialization options.
 * @returns A machine-readable {@link InitResult}.
 *
 * @example
 * ```ts
 * const result = await initializeDocumentationWorkspace({ rootDir: "/project" });
 * ```
 */
export async function initializeDocumentationWorkspace(
  options: InitOptions = {},
): Promise<InitResult> {
  const fs = options.fs ?? new NodeSafeFileSystem();
  const logger = options.logger ?? createLoggerSync();
  const mode: InitMode = options.dryRun
    ? "dry-run"
    : options.yes || options.nonInteractive
      ? "auto"
      : "interactive";

  const root = resolveProjectRoot(fs, options);

  // ── Configuration discovery ────────────────────────────────────────────
  const configPath =
    options.configPath !== undefined ? fs.join(root, options.configPath) : findConfigFile(fs, root);
  const extracted =
    configPath !== undefined
      ? extractWorkspaceConfig(fs.readFile(configPath), extname(configPath))
      : undefined;

  const layout: InitLayout = {
    next: options.layout?.next ?? extracted?.layout?.next ?? true,
    markdown: options.layout?.markdown ?? extracted?.layout?.markdown ?? true,
    static: options.layout?.static ?? extracted?.layout?.static ?? true,
  };
  const workspace: WorkspaceConfig = {
    output: {
      directory: extracted?.outputDirectory ?? options.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
      layout,
    },
    agent: {
      enabled: options.agentEnabled ?? extracted?.agentEnabled ?? true,
      skill: {
        path: extracted?.skillPath ?? "agent/skill.md",
      },
    },
  };

  const project = detectProjectInfo(fs, root);
  const skillRel = workspace.agent.skill.path;
  const outputDirectory = workspace.output.directory;

  const existing: ExistingState = {
    configFile: configPath,
    agentDir: fs.isDirectory(fs.join(root, "agent")),
    skillFile: fs.isFile(fs.join(root, skillRel)) ? fs.join(root, skillRel) : undefined,
    outputDir: fs.isDirectory(fs.join(root, outputDirectory)),
    nextDir: fs.isDirectory(fs.join(root, outputDirectory, "next")),
    mdDir: fs.isDirectory(fs.join(root, outputDirectory, "md")),
    staticDir: fs.isDirectory(fs.join(root, outputDirectory, "static")),
    alternativeDirs: ALTERNATIVE_DOC_DIRS.filter(
      (dir) => dir !== outputDirectory && fs.isDirectory(fs.join(root, dir)),
    ),
  };

  const manifestPath = manifestPathFor(fs, root);
  const existingManifest = readManifest(fs, manifestPath);
  const generatedAt = new Date().toISOString();

  // ── Templates ──────────────────────────────────────────────────────────
  const skillContent = buildSkillContent({
    projectName: project.name,
    projectDescription: project.description,
    projectType: project.projectType,
    packageManager: project.packageManager,
    packages: project.packages,
    outputDirectory,
    skillPath: skillRel,
    generatedAt,
    version: SKILL_SCHEMA_VERSION,
  });
  const configContent = buildConfigContent({
    outputDirectory,
    sourceDirectory: `./${outputDirectory}/md`,
    layout,
    agentEnabled: workspace.agent.enabled,
    skillPath: skillRel,
  });
  const configOutputFragment = [
    "output: {",
    `  directory: ${JSON.stringify(outputDirectory)},`,
    `  layout: { next: ${layout.next}, markdown: ${layout.markdown}, static: ${layout.static} },`,
    "},",
  ].join("\n");
  const configAgentFragment = [
    "agent: {",
    `  enabled: ${workspace.agent.enabled},`,
    "  skill: {",
    `    path: ${JSON.stringify(skillRel)},`,
    "  },",
    "},",
  ].join("\n");
  const agentReadme = buildAgentReadme({
    projectName: project.name,
    skillPath: skillRel,
    outputDirectory,
  });
  const plansReadme = buildPlansReadme();
  const markdownReadme = buildMarkdownReadme({ projectName: project.name });
  const staticReadme = buildStaticReadme();
  const nextScaffold = buildNextScaffold({ projectName: project.name });

  // ── Plan ───────────────────────────────────────────────────────────────
  const plan = buildInitPlan({
    fs,
    root,
    workspace,
    existing,
    manifest: existingManifest,
    templates: {
      configContent,
      configOutputFragment,
      configAgentFragment,
      skillContent,
      agentReadme,
      plansReadme,
      markdownReadme,
      staticReadme,
      nextScaffold,
    },
  });

  const manifestContent = buildManifestContent({
    fs,
    root,
    project: project.name,
    outputDirectory,
    layout,
    agentEnabled: workspace.agent.enabled,
    existing: existingManifest,
    plan,
  });

  // ── File contents map ──────────────────────────────────────────────────
  const nextScaffoldByPath = new Map(nextScaffold.map(([file, content]) => [file, content]));
  const files = new Map<string, string>();
  for (const action of plan) {
    if (action.kind !== "file") continue;
    const content = fileContentFor(action, {
      fs,
      root,
      outputDirectory,
      skillRel,
      configContent,
      configOutputFragment,
      configAgentFragment,
      skillContent,
      agentReadme,
      plansReadme,
      markdownReadme,
      staticReadme,
      nextScaffoldByPath,
      manifestContent,
    });
    if (content !== undefined) files.set(action.path, content);
  }

  if (mode === "dry-run") {
    const applied = applyPlan(plan, { fs, files, dryRun: true });
    const stateActions = planStateChanges(fs, root, ["manifests"]);
    const result: InitResult = {
      root,
      configPath: configPath ?? fs.join(root, "docs.config.ts"),
      agentPath: workspace.agent.enabled ? fs.join(root, "agent") : undefined,
      skillPath: workspace.agent.enabled ? fs.join(root, skillRel) : undefined,
      outputPath: fs.join(root, outputDirectory),
      created: applied.created,
      preserved: applied.preserved,
      merged: applied.merged,
      skipped: applied.skipped,
      conflicts: applied.conflicts,
      warnings: [],
      stateActions,
      dryRun: true,
      plan,
    };
    printInitReport({
      logger,
      root,
      configPath: result.configPath,
      agentPath: result.agentPath,
      skillPath: result.skillPath,
      outputPath: result.outputPath,
      dryRun: true,
      applied,
      plan,
      workspace,
      project,
      validation: { checks: [], passed: 0, failed: 0, ok: true },
      stateActions,
    });
    return result;
  }

  // ── Confirmation ───────────────────────────────────────────────────────
  if (options.nonInteractive && requiresConfirmation(plan)) {
    logger.warn("Initialization aborted: conflicting paths require confirmation.");
    for (const action of plan) {
      if (action.interactive) logger.warn(`  ${action.path}`);
    }
    return resultFromAbort(root, plan, workspace, configPath, skillRel, outputDirectory);
  }
  const decision = await confirmPlan(plan, { mode });
  if (decision === "abort") {
    logger.warn("Initialization cancelled.");
    return resultFromAbort(root, plan, workspace, configPath, skillRel, outputDirectory);
  }

  // ── Apply ──────────────────────────────────────────────────────────────
  const applied = applyPlan(plan, { fs, files, dryRun: false });

  // ── Internal state (dynamic, non-destructive) ──────────────────────────
  const state = createDocsStateManager({ rootDir: root, fs, project: project.name });
  state.initialize();
  state.migrate();
  state.ensureNamespace("manifests");
  ensureStateIgnored(fs, root);
  const stateActions = planStateChanges(fs, root, ["manifests"]);

  // ── Validate ───────────────────────────────────────────────────────────
  const finalManifest = readManifest(fs, manifestPath);
  const validation = validateWorkspace({
    fs,
    root,
    workspace,
    manifest: finalManifest,
    configPath: configPath ?? fs.join(root, "docs.config.ts"),
    manifestPath,
  });

  const result = buildInitResult({
    root,
    configPath: configPath ?? fs.join(root, "docs.config.ts"),
    agentPath: workspace.agent.enabled ? fs.join(root, "agent") : undefined,
    skillPath: workspace.agent.enabled ? fs.join(root, skillRel) : undefined,
    outputPath: fs.join(root, outputDirectory),
    dryRun: false,
    applied,
    plan,
    workspace,
    project,
    stateActions,
  });

  printInitReport({
    logger,
    root,
    configPath: result.configPath,
    agentPath: result.agentPath,
    skillPath: result.skillPath,
    outputPath: result.outputPath,
    dryRun: false,
    applied,
    plan,
    workspace,
    project,
    validation,
    stateActions,
  });

  return result;
}

function resultFromAbort(
  root: string,
  plan: readonly PlanAction[],
  workspace: WorkspaceConfig,
  configPath: string | undefined,
  skillRel: string,
  outputDirectory: string,
): InitResult {
  const conflicts = plan.filter((a) => a.action === "conflict").map((a) => a.path);
  return {
    root,
    configPath,
    agentPath: workspace.agent.enabled ? `${root}/agent` : undefined,
    skillPath: workspace.agent.enabled ? `${root}/${skillRel}` : undefined,
    outputPath: `${root}/${outputDirectory}`,
    created: [],
    preserved: [],
    merged: [],
    skipped: [],
    conflicts,
    warnings: ["Initialization aborted"],
    stateActions: [],
    dryRun: false,
    plan,
  };
}

interface FileContentOptions {
  readonly fs: SafeFileSystem;
  readonly root: string;
  readonly outputDirectory: string;
  readonly skillRel: string;
  readonly configContent: string;
  readonly configOutputFragment: string;
  readonly configAgentFragment: string;
  readonly skillContent: string;
  readonly agentReadme: string;
  readonly plansReadme: string;
  readonly markdownReadme: string;
  readonly staticReadme: string;
  readonly nextScaffoldByPath: ReadonlyMap<string, string>;
  readonly manifestContent: string;
}

/** Resolve the content a plan action should write, or `undefined` for dirs. */
function fileContentFor(action: PlanAction, options: FileContentOptions): string | undefined {
  const { fs, root } = options;
  const rel = fs.relative(root, action.path);
  const out = options.outputDirectory;

  const isConfig = [
    "docs.config.ts",
    "docs.config.js",
    "docs.config.mjs",
    "docs.config.cjs",
  ].includes(rel);
  if (isConfig) {
    if (action.action === "merge" && fs.isFile(action.path)) {
      return mergeConfigContent(fs.readFile(action.path), {
        output: options.configOutputFragment,
        agent: options.configAgentFragment,
      });
    }
    return options.configContent;
  }

  if (rel === options.skillRel) {
    if (action.action === "merge" && fs.isFile(action.path)) {
      return mergeSkillContent(fs.readFile(action.path), options.skillContent);
    }
    return options.skillContent;
  }

  if (rel === "agent/README.md") return options.agentReadme;
  if (rel === "agent/plans/README.md") return options.plansReadme;
  if (rel === `${out}/md/README.md`) return options.markdownReadme;
  if (rel === `${out}/static/README.md`) return options.staticReadme;
  if (rel === ".vetwo/docs/manifests/workspace.json") return options.manifestContent;

  if (rel.startsWith(`${out}/next/`)) {
    const scaffoldRel = rel.slice(`${out}/next/`.length);
    const content = options.nextScaffoldByPath.get(scaffoldRel);
    if (content !== undefined) return content;
  }
  return undefined;
}

interface ManifestContentOptions {
  readonly fs: SafeFileSystem;
  readonly root: string;
  readonly project: string;
  readonly outputDirectory: string;
  readonly layout: InitLayout;
  readonly agentEnabled: boolean;
  readonly existing: WorkspaceManifest | undefined;
  readonly plan: readonly PlanAction[];
}

/** Build the manifest JSON for the update action. */
function buildManifestContent(options: ManifestContentOptions): string {
  const createdDirs = options.plan
    .filter((a) => a.action === "create" && a.kind === "directory")
    .map((a) => options.fs.relative(options.root, a.path));
  const createdFiles: ManifestFileEntry[] = options.plan
    .filter((a) => a.action === "create" && a.kind === "file")
    .map((a) => ({
      path: options.fs.relative(options.root, a.path),
      ownership: "system-generated" as Ownership,
      template: templateName(options.fs.relative(options.root, a.path)),
      version: SKILL_SCHEMA_VERSION,
    }));
  const mergedOrUpdated: ManifestFileEntry[] = options.plan
    .filter((a) => a.action === "merge" || a.action === "update")
    .map((a) => ({
      path: options.fs.relative(options.root, a.path),
      ownership: "system-managed" as Ownership,
      template: templateName(options.fs.relative(options.root, a.path)),
      version: SKILL_SCHEMA_VERSION,
    }));

  const fresh = createManifest(
    {
      project: options.project,
      root: options.root,
      outputDirectory: options.outputDirectory,
      layout: options.layout,
      agentEnabled: options.agentEnabled,
    },
    new Date().toISOString(),
  );

  const merged = mergeManifest(options.existing, {
    ...fresh,
    directories: [...new Set([...fresh.directories, ...createdDirs])],
    files: [...fresh.files, ...createdFiles, ...mergedOrUpdated],
  });

  return JSON.stringify(merged, null, 2) + "\n";
}

function templateName(rel: string): string {
  if (
    rel === "docs.config.ts" ||
    rel === "docs.config.js" ||
    rel === "docs.config.mjs" ||
    rel === "docs.config.cjs"
  ) {
    return "config";
  }
  if (rel.endsWith("skill.md")) return "skill";
  if (rel.includes("/next/")) return `next:${rel.slice(rel.indexOf("/next/") + 6)}`;
  if (rel.includes("manifests/workspace.json")) return "manifest";
  return rel;
}
