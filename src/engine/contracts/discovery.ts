import type { ProjectDetection } from "../../scanner/project.js";
import type { ProjectModel } from "../../scanner/models/project.js";
import type { ScannerScanOptions } from "../../scanner/engine/engine.js";
import type { SourceFile } from "../../types/public.js";

/**
 * Internal engine contract for project and documentation discovery.
 *
 * Project discovery (workspace, packages, framework, package manager,
 * project type) is intentionally separated from documentation discovery
 * (markdown/mdx/source files). The unified scanner index is available through
 * `scanProject`.
 */
export interface DiscoveryProviderContract {
  readonly detectProject: (rootDir: string) => ProjectDetection;
  readonly discoverDocFiles: (
    rootDir: string,
    source: string,
    ignore: readonly string[],
  ) => Promise<readonly SourceFile[]>;
  readonly discoverSourceFiles: (
    rootDir: string,
    source: string,
    exclude: readonly string[],
  ) => Promise<readonly SourceFile[]>;
  readonly scanProject: (rootDir: string, options?: ScannerScanOptions) => Promise<ProjectModel>;
}
