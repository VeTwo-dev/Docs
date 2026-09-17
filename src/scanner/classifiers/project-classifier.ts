import type { PackageManager, ProjectType } from "../../types/public.js";
import type { ProjectClassification } from "../types/categories.js";
import type { ProjectClassifier, ProjectClassificationInput } from "./types.js";

/** Dependencies that strongly indicate an application project. */
export const APPLICATION_DEPENDENCIES: ReadonlySet<string> = new Set([
  "next",
  "nuxt",
  "astro",
  "gatsby",
  "remix",
  "@remix-run/react",
  "sveltekit",
  "@sveltejs/kit",
  "solid-start",
  "@angular/core",
  "react-native",
  "expo",
  "express",
  "fastify",
  "@nestjs/core",
  "koa",
  "hapi",
  "sails",
  "adonisjs",
  "django",
  "flask",
  "rails",
  "laravel",
  "vue-router",
]);

/** Keyword/name markers for each rich classification. */
const CLASSIFICATION_MARKERS: Readonly<
  Record<Exclude<ProjectClassification, "application" | "monorepo" | "unknown">, readonly string[]>
> = {
  framework: ["framework", "-framework"],
  cli: ["cli", "-cli"],
  plugin: ["plugin", "-plugin"],
  theme: ["theme", "-theme"],
  sdk: ["sdk", "-sdk", "client-sdk"],
  template: ["template", "starter", "-template", "-starter"],
  tooling: ["tooling", "devtools", "-tool", "-cli-tool"],
  library: ["library", "-lib"],
};

/** The built-in project classifier. */
export const projectClassifier: ProjectClassifier = (input) => classifyProject(input);

/**
 * Classifies a project into one or more rich classifications.
 *
 * @param input - The project classification input.
 * @returns The matching classifications (never empty).
 */
export function classifyProject(
  input: ProjectClassificationInput,
): readonly ProjectClassification[] {
  const classifications: ProjectClassification[] = [];

  const isMonorepo = input.hasWorkspaces || input.packageCount > 1;
  if (isMonorepo) classifications.push("monorepo");

  const dependencies = {
    ...input.dependencies,
    ...input.devDependencies,
    ...input.peerDependencies,
  };
  const dependencyNames = Object.keys(dependencies);
  const isApplication = dependencyNames.some((name) => APPLICATION_DEPENDENCIES.has(name));
  if (isApplication) classifications.push("application");

  const lowerName = input.name.toLowerCase();
  const keywords = input.keywords.map((keyword) => keyword.toLowerCase());
  for (const [classification, markers] of Object.entries(CLASSIFICATION_MARKERS)) {
    if (classifications.includes(classification as ProjectClassification)) continue;
    const matched = markers.some((marker) => {
      if (marker.startsWith("-")) return lowerName.endsWith(marker);
      return keywords.includes(marker) || lowerName === marker;
    });
    if (matched) classifications.push(classification as ProjectClassification);
  }

  if (input.isRootPackage && !input.hasWorkspaces) {
    const hasBuildScript =
      input.scripts["build"] !== undefined || input.scripts["build:docs"] !== undefined;
    if (hasBuildScript && !isApplication && !classifications.some((c) => c === "framework")) {
      classifications.push("library");
    }
  }

  if (classifications.length === 0) classifications.push("unknown");
  return classifications;
}

/**
 * Maps rich classifications onto the coarse public {@link ProjectType}.
 *
 * @param classifications - The rich classifications.
 * @returns The coarse project type.
 */
export function coarseProjectType(classifications: readonly ProjectClassification[]): ProjectType {
  if (classifications.includes("monorepo")) return "monorepo";
  if (classifications.includes("application")) return "application";
  if (classifications.every((classification) => classification === "unknown")) return "unknown";
  return "library";
}

/** Normalises a detected package manager into the public union. */
export function normalizePackageManager(
  value: string | undefined,
  fallback: PackageManager = "npm",
): PackageManager {
  if (value === "pnpm" || value === "yarn" || value === "bun" || value === "npm") return value;
  return fallback;
}
