export {
  detectProject,
  detectPackageManager,
  detectPM,
  detectProjectType,
  detectWorkspaces,
  getWorkspaceInfo,
  discoverPackages,
  detectTypeScript,
  detectGit,
  detectReadme,
  detectChangelog,
} from "../scanner/project.js";
export type { ProjectDetection } from "../scanner/project.js";
export { discoverDocFiles, discoverSourceFiles } from "../scanner/files.js";
