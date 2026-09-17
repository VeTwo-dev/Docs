import type { Logger } from "../../types/internal.js";
import type { SafeFileSystem } from "../filesystem/interface.js";

/**
 * Execution mode of `docs init`.
 *
 * - `interactive` — prompts the user when a decision is required.
 * - `auto` — applies only safe, non-destructive actions (`--yes`).
 * - `dry-run` — plans everything but writes nothing.
 */
export type InitMode = "interactive" | "auto" | "dry-run";

/** Output layout flags resolved for a given initialization run. */
export interface InitLayout {
  readonly next: boolean;
  readonly markdown: boolean;
  readonly static: boolean;
}

/**
 * Options accepted by {@link initializeDocumentationWorkspace}.
 *
 * All options are optional; sensible defaults are derived from the
 * environment and the detected project.
 */
export interface InitOptions {
  /** Explicit project root. Overrides all other detection. */
  readonly rootDir?: string;
  /** Directory to start root detection from (defaults to `process.cwd()`). */
  readonly cwd?: string;
  /** Override the documentation output directory (e.g. `wiki`). */
  readonly outputDirectory?: string;
  /** Override individual output layouts. */
  readonly layout?: Partial<InitLayout>;
  /** Enable the AI agent workspace (defaults to `true`). */
  readonly agentEnabled?: boolean;
  /** Explicit path to an existing configuration file. */
  readonly configPath?: string;
  /** Plan only; write nothing. */
  readonly dryRun?: boolean;
  /** Apply only safe non-destructive actions; never prompt. */
  readonly yes?: boolean;
  /** Fail instead of prompting when a conflict cannot be resolved. */
  readonly nonInteractive?: boolean;
  /** Logger used for diagnostics. */
  readonly logger?: Logger;
  /** Filesystem seam (test / embedded usage). */
  readonly fs?: SafeFileSystem;
}
