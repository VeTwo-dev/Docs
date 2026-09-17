/**
 * @module @vetwo/docs
 *
 * A documentation generator for modern JavaScript/TypeScript projects.
 * Provides configuration, file discovery, markdown processing, SEO, search,
 * API documentation extraction, plugins, and more.
 *
 * @example
 * ```ts
 * import { build, defineDocs, createLogger } from "@vetwo/docs";
 *
 * const log = createLogger();
 * await build({ rootDir: ".", logger: log });
 * ```
 */
export { defineDocs } from "./config/define.js";
export { loadConfig, resolveConfigPath } from "./config/loader.js";
export type {
  DocsConfig,
  DocsConfigInput,
  ThemeConfig,
  NavConfig,
  SidebarConfig,
  SeoConfig,
  SearchConfig,
  VersioningConfig,
  MarkdownConfig,
  ApiConfig,
} from "./config/types.js";

export type {
  PackageManager,
  ProjectType,
  WorkspaceInfo,
  PackageInfo,
  SourceFile,
  DocPage,
  Heading,
  PageLink,
  NavItem,
  SidebarItem,
  SidebarGroup,
  SearchEntry,
  SearchIndex,
  ApiDocEntry,
  ApiParameter,
  SeoMetadata,
  SitemapEntry,
  RssEntry,
  LifecycleHookName,
} from "./types/public.js";

export type {
  BuildContext,
  Plugin,
  HookContext,
  FeatureGenerator,
  Logger,
} from "./types/internal.js";

export { build } from "./core/index.js";
export { detectProject, discoverDocFiles, discoverSourceFiles } from "./scanner/index.js";
export { createLogger } from "./logger/index.js";
export { createPluginRegistry } from "./plugins/index.js";
export { openApi, mermaid } from "./plugins/built-in/index.js";
export { createHookRegistry } from "./hooks/index.js";

export * as examples from "./examples/index.js";
export * as documentationRelations from "./documentation-relations/index.js";
export * as intelligence from "./intelligence/index.js";
export * as state from "./state/index.js";
