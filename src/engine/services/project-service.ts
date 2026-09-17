import type { ProjectDetection } from "../../scanner/project.js";
import { detectProject } from "../../scanner/project.js";
import type { ServiceFactory } from "../container.js";

/**
 * Project service — detects the surrounding project context.
 *
 * Detects package manager, project type, workspace layout, packages and
 * repository metadata (TypeScript, Git, README, changelog).
 */
export interface ProjectService {
  readonly detect: (rootDir: string) => ProjectDetection;
}

export const PROJECT_SERVICE = "project";

export const projectServiceFactory: ServiceFactory<ProjectService> = () => ({
  detect: (rootDir) => detectProject(rootDir),
});
