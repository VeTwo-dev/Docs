import type { DocsConfig } from "../config/types.js";
import { resolveOutputDirectory } from "../config/resolve.js";
import type { BuildContextMutable, BuildContext } from "../types/internal.js";
import type { CacheStore } from "../cache/index.js";
import type {
  PackageManager,
  ProjectType,
  WorkspaceInfo,
  PackageInfo,
  SourceFile,
  DocPage,
  NavItem,
  SidebarGroup,
  SearchIndex,
  ApiDocEntry,
  SitemapEntry,
  RssEntry,
} from "../types/public.js";

/**
 * Creates a mutable build context populated with configuration and project detection results.
 * Arrays are initialised as empty and populated later by pipeline stages.
 *
 * @param config - The resolved documentation configuration.
 * @param rootDir - The project root directory.
 * @param detection - The project detection result.
 * @returns A new {@link BuildContextMutable} instance.
 *
 * @example
 * ```ts
 * const ctx = createBuildContext(config, "/project", detection);
 * ```
 */
export function createBuildContext(
  config: DocsConfig,
  rootDir: string,
  detection: {
    projectType: ProjectType;
    packageManager: PackageManager;
    workspaceInfo: WorkspaceInfo | undefined;
    packages: readonly PackageInfo[];
  },
  cache?: CacheStore,
): BuildContextMutable {
  return {
    config,
    rootDir,
    sourceDir: config.source,
    outputDir: resolveOutputDirectory(config),
    projectType: detection.projectType,
    packageManager: detection.packageManager,
    workspaceInfo: detection.workspaceInfo,
    packages: detection.packages,
    sourceFiles: [] as SourceFile[],
    pages: [] as DocPage[],
    navItems: [] as NavItem[],
    sidebarGroups: [] as SidebarGroup[],
    searchIndex: undefined as SearchIndex | undefined,
    apiDocs: [] as ApiDocEntry[],
    sitemapEntries: [] as SitemapEntry[],
    rssEntries: [] as RssEntry[],
    errors: [],
    warnings: [],
    startTime: Date.now(),
    cache: cache as CacheStore | undefined,
  };
}

/**
 * Freezes a mutable build context into an immutable {@link BuildContext} by deeply
 * freezing all mutable fields.
 *
 * @param ctx - The mutable build context to freeze.
 * @returns An immutable snapshot of the build context.
 *
 * @example
 * ```ts
 * const frozen = freezeContext(ctx);
 * ```
 */
export function freezeContext(ctx: BuildContextMutable): BuildContext {
  return Object.freeze({
    ...ctx,
    pages: Object.freeze([...ctx.pages]),
    navItems: Object.freeze([...ctx.navItems]),
    sidebarGroups: Object.freeze([...ctx.sidebarGroups]),
    sitemapEntries: Object.freeze([...ctx.sitemapEntries]),
    rssEntries: Object.freeze([...ctx.rssEntries]),
    apiDocs: Object.freeze([...ctx.apiDocs]),
    errors: Object.freeze([...ctx.errors]),
    warnings: Object.freeze([...ctx.warnings]),
  });
}
