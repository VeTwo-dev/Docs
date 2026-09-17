import type { SafeFileSystem } from "../filesystem/interface.js";
import type { WorkspaceConfig } from "../types/workspace.js";
import type { WorkspaceManifest } from "../types/manifest.js";
import { MANIFEST_SCHEMA_VERSION } from "../types/manifest.js";

/** A single validation check. */
export interface ValidationCheck {
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** The result of validating a prepared workspace. */
export interface ValidationReport {
  readonly checks: readonly ValidationCheck[];
  readonly passed: number;
  readonly failed: number;
  readonly ok: boolean;
}

/** Input for {@link validateWorkspace}. */
export interface ValidateInput {
  readonly fs: SafeFileSystem;
  readonly root: string;
  readonly workspace: WorkspaceConfig;
  readonly manifest: WorkspaceManifest | undefined;
  readonly configPath: string | undefined;
  readonly manifestPath: string | undefined;
}

/**
 * Validates the workspace after initialization. Returns a per-check report
 * and an overall pass/fail — never throws.
 */
export function validateWorkspace(input: ValidateInput): ValidationReport {
  const { fs, root, workspace, manifest, configPath, manifestPath } = input;
  const checks: ValidationCheck[] = [];
  const at = (rel: string): string => fs.join(root, rel);

  const configCheck: ValidationCheck = {
    label: "Configuration",
    pass: configPath !== undefined && fs.isFile(configPath),
    detail:
      configPath !== undefined && fs.isFile(configPath) ? configPath : "Missing configuration file",
  };
  checks.push(configCheck);

  if (workspace.agent.enabled) {
    const skillPath = at(workspace.agent.skill.path);
    checks.push({
      label: "Agent skill",
      pass: fs.isFile(skillPath),
      detail: fs.isFile(skillPath)
        ? skillPath
        : `Missing skill file: ${workspace.agent.skill.path}`,
    });
    for (const sub of ["plans", "briefs", "context", "generated", "reports"]) {
      checks.push({
        label: `agent/${sub}`,
        pass: fs.isDirectory(at(`agent/${sub}`)),
        detail: `agent/${sub}`,
      });
    }
  }

  const outputDir = workspace.output.directory;
  const out = at(outputDir);
  checks.push({
    label: "Output workspace",
    pass: fs.isDirectory(out),
    detail: out,
  });

  if (workspace.output.layout.next) {
    const nextDir = at(`${outputDir}/next`);
    checks.push({
      label: "Next.js workspace",
      pass: fs.isDirectory(nextDir) && fs.isFile(at(`${outputDir}/next/package.json`)),
      detail: fs.isDirectory(nextDir) ? `${outputDir}/next` : `Missing ${outputDir}/next`,
    });
  }
  if (workspace.output.layout.markdown) {
    checks.push({
      label: "Markdown workspace",
      pass: fs.isDirectory(at(`${outputDir}/md`)),
      detail: `${outputDir}/md`,
    });
  }
  if (workspace.output.layout.static) {
    checks.push({
      label: "Static workspace",
      pass: fs.isDirectory(at(`${outputDir}/static`)),
      detail: `${outputDir}/static`,
    });
  }

  const manifestOk =
    manifest !== undefined &&
    manifest.schemaVersion === MANIFEST_SCHEMA_VERSION &&
    Array.isArray(manifest.files);
  checks.push({
    label: "Workspace manifest",
    pass: manifestOk,
    detail: manifestPath ?? "No manifest path",
  });

  const missingOwned: string[] = [];
  if (manifest !== undefined) {
    for (const entry of manifest.files) {
      if (!fs.exists(at(entry.path))) missingOwned.push(entry.path);
    }
  }
  checks.push({
    label: "Ownership metadata",
    pass: missingOwned.length === 0,
    detail:
      missingOwned.length === 0
        ? "All tracked files present"
        : `Missing tracked files: ${missingOwned.join(", ")}`,
  });

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  return { checks, passed, failed, ok: failed === 0 };
}
