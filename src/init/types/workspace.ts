import type { InitLayout } from "./options.js";

/**
 * The documentation workspace configuration the initialization system works
 * against. It mirrors the `output` + `agent` sections of `docs.config.ts`.
 */
export interface WorkspaceConfig {
  /** Output workspace configuration. */
  readonly output: {
    /** Directory that holds the documentation workspace. */
    readonly directory: string;
    /** Which layouts are enabled. */
    readonly layout: InitLayout;
  };
  /** AI agent workspace configuration. */
  readonly agent: {
    readonly enabled: boolean;
    readonly skill: {
      readonly path: string;
    };
  };
}

/** A detected package within the project. */
export interface DetectedPackage {
  readonly name: string;
  readonly description?: string;
}

/** Summary of the detected project used to customise generated files. */
export interface DetectedProject {
  readonly rootDir: string;
  readonly name: string;
  readonly description: string;
  readonly projectType: string;
  readonly packageManager: string;
  readonly packages: readonly DetectedPackage[];
  readonly hasTypeScript: boolean;
  readonly hasGit: boolean;
  readonly readmePath?: string;
  readonly changelogPath?: string;
}

/** Existing documentation-related state discovered before planning. */
export interface ExistingState {
  /** Absolute path of the configuration file when one was found. */
  readonly configFile: string | undefined;
  /** Whether the agent directory already exists. */
  readonly agentDir: boolean;
  /** Absolute path of the skill file when one was found. */
  readonly skillFile: string | undefined;
  /** Whether the configured output directory already exists. */
  readonly outputDir: boolean;
  /** Whether the output `next/` layout already exists. */
  readonly nextDir: boolean;
  /** Whether the output `md/` layout already exists. */
  readonly mdDir: boolean;
  /** Whether the output `static/` layout already exists. */
  readonly staticDir: boolean;
  /** Detected alternative documentation directories that already exist. */
  readonly alternativeDirs: readonly string[];
}
