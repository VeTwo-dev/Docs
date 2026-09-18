/**
 * Project Identity Discovery (Phase 22).
 * Determines package metadata, package manager, language, framework, type.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectIdentity, ProjectTypeExt } from "../knowledge.js";

function detectPackageManager(rootDir: string): ProjectIdentity["packageManager"] {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "bun.lockb"))) return "bun";
  return "npm";
}

function detectProjectType(
  pkg: Record<string, unknown>,
  hasBin: boolean,
  isMonorepo: boolean,
  framework?: string,
): ProjectTypeExt {
  if (isMonorepo) return "monorepo";
  if (framework?.includes("next")) return "nextjs-application";
  if (framework?.includes("react")) return "react-application";
  if (framework?.includes("vue")) return "vue-application";
  if (framework === "vite") return "vite-application";
  if (hasBin) return "cli";
  const keywords = (pkg["keywords"] as string[] | undefined) ?? [];
  if (keywords.includes("sdk")) return "sdk";
  if (keywords.includes("plugin")) return "plugin";
  if (keywords.includes("framework")) return "framework";
  if (pkg["private"] === true) return "application";
  return "library";
}

export function discoverIdentity(
  rootDir: string,
  opts: { framework?: string; hasBin?: boolean; isMonorepo?: boolean } = {},
): ProjectIdentity {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  } catch {
    // Best-effort discovery — ignore unreadable entries.
  }
  const pm = detectPackageManager(rootDir);
  const name = (pkg["name"] as string | undefined) ?? "unknown";
  const displayName = name.replace(/^@[^/]+\//, "");
  const hasBin = opts.hasBin ?? pkg["bin"] !== undefined;
  const isMonorepo = opts.isMonorepo ?? Array.isArray((pkg as { workspaces?: unknown }).workspaces);
  const framework = opts.framework;
  return {
    packageName: name,
    displayName,
    description: pkg["description"] as string | undefined,
    version: pkg["version"] as string | undefined,
    license: pkg["license"] as string | undefined,
    repository:
      typeof pkg["repository"] === "string"
        ? pkg["repository"]
        : (pkg["repository"] as { url?: string } | undefined)?.url,
    homepage: pkg["homepage"] as string | undefined,
    bugsUrl:
      typeof pkg["bugs"] === "string"
        ? pkg["bugs"]
        : (pkg["bugs"] as { url?: string } | undefined)?.url,
    packageManager: pm,
    language: existsSync(join(rootDir, "tsconfig.json")) ? "typescript" : "javascript",
    framework,
    runtime: (pkg["engines"] as unknown as Record<string, string> | undefined)?.["node"]
      ? `Node.js ${(pkg["engines"] as unknown as Record<string, string>)["node"]}`
      : undefined,
    projectType: detectProjectType(pkg, hasBin, isMonorepo, framework),
    isMonorepo,
  };
}
