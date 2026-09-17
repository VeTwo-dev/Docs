export { defineDocs, DEFAULT_OUTPUT_LAYOUT } from "./define.js";
export { loadConfig, resolveConfigPath, mergePlugins } from "./loader.js";
export { resolveOutputDirectory, resolveOutputLayout } from "./resolve.js";
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
  MonorepoConfig,
  OutputLayoutConfig,
  AgentConfig,
  AgentSkillConfig,
  AIConfig,
  AIProviderEntry,
  ArchitectureConfig,
  ComponentsConfig,
} from "./types.js";
