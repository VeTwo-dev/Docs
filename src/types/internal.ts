import type {
  DocPage,
  NavItem,
  SidebarGroup,
  SearchIndex,
  ApiDocEntry,
  SitemapEntry,
  RssEntry,
  PackageInfo,
  PackageManager,
  ProjectType,
  WorkspaceInfo,
  SourceFile,
  LifecycleHookName,
} from "./public.js";
import type { DocsConfig } from "../config/types.js";
import type { CacheStore } from "../cache/index.js";

/** Immutable build context exposed after the build completes. */
export interface BuildContext {
  readonly config: DocsConfig;
  readonly rootDir: string;
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly projectType: ProjectType;
  readonly packageManager: PackageManager;
  readonly workspaceInfo: WorkspaceInfo | undefined;
  readonly packages: readonly PackageInfo[];
  readonly sourceFiles: readonly SourceFile[];
  pages: readonly DocPage[];
  navItems: readonly NavItem[];
  sidebarGroups: readonly SidebarGroup[];
  searchIndex: SearchIndex | undefined;
  apiDocs: readonly ApiDocEntry[];
  sitemapEntries: readonly SitemapEntry[];
  rssEntries: readonly RssEntry[];
  errors: readonly BuildError[];
  warnings: readonly BuildWarning[];
  startTime: number;
  readonly cache?: CacheStore;
}

/** Mutable build context used throughout the pipeline stages. */
export interface BuildContextMutable extends Omit<
  BuildContext,
  | "pages"
  | "navItems"
  | "sidebarGroups"
  | "sitemapEntries"
  | "rssEntries"
  | "errors"
  | "warnings"
  | "apiDocs"
> {
  pages: DocPage[];
  navItems: NavItem[];
  sidebarGroups: SidebarGroup[];
  searchIndex: SearchIndex | undefined;
  apiDocs: ApiDocEntry[];
  sitemapEntries: SitemapEntry[];
  rssEntries: RssEntry[];
  errors: BuildError[];
  warnings: BuildWarning[];
  cache?: CacheStore;
}

/** Represents a build error with optional source location. */
export interface BuildError {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly column?: number;
}

/** Represents a build warning with optional source file. */
export interface BuildWarning {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
}

/** A plugin that hooks into the build lifecycle. */
export interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly hooks: Partial<Record<LifecycleHookName, HookHandler>>;
  readonly config?: Partial<DocsConfig>;
}

/** Context passed to hook handlers during pipeline execution. */
export interface HookContext {
  readonly ctx: BuildContextMutable;
  readonly config: DocsConfig;
  readonly log: Logger;
}

/** A function that handles a lifecycle hook. */
export interface HookHandler {
  (context: HookContext): void | Promise<void>;
}

/** Logger interface for outputting build messages. */
export interface Logger {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
  readonly debug: (message: string) => void;
  readonly success: (message: string) => void;
  readonly spin: (message: string) => Spinner;
  readonly progress: (current: number, total: number, label?: string) => void;
  readonly box: (title: string, content: string) => void;
  readonly table: (headers: readonly string[], rows: readonly (readonly string[])[]) => void;
}

/** A terminal spinner for indicating ongoing operations. */
export interface Spinner {
  readonly succeed: (message?: string) => void;
  readonly fail: (message?: string) => void;
  readonly warn: (message?: string) => void;
  readonly info: (message?: string) => void;
  readonly stop: () => void;
  readonly text: string;
}

/** A single stage in the build pipeline. */
export interface PipelineStage {
  readonly name: string;
  readonly handler: PipelineHandler;
}

/** A function that processes a pipeline stage. */
export interface PipelineHandler {
  (context: BuildContextMutable): void | Promise<void>;
}

/** A feature generator that can be enabled or disabled by configuration. */
export interface FeatureGenerator {
  readonly name: string;
  readonly enabled: (config: DocsConfig) => boolean;
  readonly generate: (context: BuildContextMutable) => void | Promise<void>;
}
