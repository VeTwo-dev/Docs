import type { ProjectDetection } from "../../scanner/project.js";
import type { SourceFile } from "../../types/public.js";
import { detectProject } from "../../scanner/project.js";
import { discoverDocFiles, discoverSourceFiles } from "../../scanner/files.js";
import { createScannerEngine, type ScannerScanOptions } from "../../scanner/engine/engine.js";
import type { ProjectModel } from "../../scanner/models/project.js";
import type { ServiceFactory } from "../container.js";

/**
 * Discovery service — finds documentation and source files.
 *
 * Project discovery (workspace/packages/framework/PM/project type) is owned
 * by the {@link ProjectService}; this service owns documentation discovery
 * (markdown/mdx/source files/assets) plus convenience access to the merged
 * project detection and the unified scanner index.
 */
export interface DiscoveryService {
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
  /** Runs the universal scanner and returns the unified project index. */
  readonly scanProject: (rootDir: string, options?: ScannerScanOptions) => Promise<ProjectModel>;
}

export const DISCOVERY_SERVICE = "discovery";

export const discoveryServiceFactory: ServiceFactory<DiscoveryService> = () => ({
  detectProject: (rootDir) => detectProject(rootDir),
  discoverDocFiles: (rootDir, source, ignore) => discoverDocFiles(rootDir, source, ignore),
  discoverSourceFiles: (rootDir, source, exclude) => discoverSourceFiles(rootDir, source, exclude),
  scanProject: (rootDir, options) => {
    const engine = createScannerEngine({ rootDir });
    return engine.scan(options);
  },
});
