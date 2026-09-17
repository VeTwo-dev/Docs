/**
 * Classification vocabulary used by the scanner subsystem.
 *
 * These are the canonical categories assigned to files, directories, assets,
 * configurations and projects. They are intentionally decoupled from any
 * rendering or documentation concern — a file's category answers "what kind
 * of resource is this?", nothing more.
 */

/** The functional category of a scanned file. */
export type FileCategory =
  | "source"
  | "declaration"
  | "documentation"
  | "config"
  | "test"
  | "story"
  | "example"
  | "benchmark"
  | "snapshot"
  | "style"
  | "script"
  | "asset"
  | "generated"
  | "cache"
  | "build-output"
  | "temporary"
  | "unknown";

/** The category of a scanned directory, derived from its name and contents. */
export type DirectoryCategory =
  | "root"
  | "src"
  | "docs"
  | "examples"
  | "packages"
  | "apps"
  | "tests"
  | "scripts"
  | "assets"
  | "public"
  | "playground"
  | "stories"
  | "dist"
  | "build"
  | "coverage"
  | "cache"
  | "generated"
  | "vendor"
  | "node_modules"
  | "ci"
  | "ide"
  | "unknown";

/** The high-level type of a detected asset file. */
export type AssetType =
  | "image"
  | "font"
  | "video"
  | "audio"
  | "icon"
  | "svg"
  | "static"
  | "document"
  | "archive"
  | "unknown";

/** The serialisation format of a detected configuration file. */
export type ConfigFormat = "json" | "jsonc" | "yaml" | "toml" | "js" | "ts" | "ini" | "dotfile";

/** A rich project classification beyond the coarse {@link ProjectType}. */
export type ProjectClassification =
  | "monorepo"
  | "application"
  | "framework"
  | "library"
  | "cli"
  | "plugin"
  | "theme"
  | "sdk"
  | "template"
  | "tooling"
  | "unknown";

/** The tool that defines a workspace layout. */
export type WorkspaceKind =
  "pnpm" | "npm" | "yarn" | "bun" | "lerna" | "nx" | "turbo" | "rush" | "moonrepo" | "none";

/** The kind of resource stored in the project index. */
export type ResourceKind = "file" | "directory" | "asset" | "configuration" | "package";

/** Whether a file is tracked by the index or was pruned by ignore rules. */
export type Visibility = "included" | "excluded";

/** Severity of a scanner diagnostic. */
export type DiagnosticSeverity = "info" | "warning" | "error";

/** The category a scanner diagnostic belongs to. */
export type DiagnosticCategory =
  | "duplicate"
  | "broken-symlink"
  | "missing-manifest"
  | "invalid-manifest"
  | "circular-workspace"
  | "permission"
  | "glob"
  | "warning"
  | "info";

/** The kind of relationship recorded between two indexed resources. */
export type RelationshipType = "package" | "workspace" | "configuration" | "asset" | "contains";

/** The source a project index was built from. */
export type ScanSource = "full" | "incremental";
