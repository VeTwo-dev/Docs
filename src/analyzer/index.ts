import type {
  ProjectAnalysis,
  ConfigFile,
  ConfigFileKind,
  DirectoryNode,
  FrameworkDetection,
  PublicExport,
} from "../generator/types.js";
import type { PackageInfo, SourceFile } from "../types/public.js";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

const CONFIG_FILE_PATTERNS: Array<{ pattern: RegExp; kind: ConfigFileKind }> = [
  { pattern: /^package\.json$/, kind: "package-manager" },
  { pattern: /^pnpm-workspace\.yaml$/, kind: "workspace" },
  { pattern: /^lerna\.json$/, kind: "workspace" },
  { pattern: /^turbo\.json$/, kind: "workspace" },
  { pattern: /^nx\.json$/, kind: "workspace" },
  { pattern: /^tsconfig(?:\.\w+)?\.json$/, kind: "typescript" },
  { pattern: /^jsconfig(?:\.\w+)?\.json$/, kind: "typescript" },
  { pattern: /^vite\.config\.\w+$/, kind: "bundler" },
  { pattern: /^webpack\.config\.\w+$/, kind: "bundler" },
  { pattern: /^rollup\.config\.\w+$/, kind: "bundler" },
  { pattern: /^esbuild\.config\.\w+$/, kind: "bundler" },
  { pattern: /^next\.config\.\w+$/, kind: "framework" },
  { pattern: /^nuxt\.config\.\w+$/, kind: "framework" },
  { pattern: /^astro\.config\.\w+$/, kind: "framework" },
  { pattern: /^angular\.json$/, kind: "framework" },
  { pattern: /^svelte\.config\.\w+$/, kind: "framework" },
  { pattern: /^vitest\.config\.\w+$/, kind: "other" },
  { pattern: /^jest\.config\.\w+$/, kind: "other" },
  { pattern: /^\.eslintrc/, kind: "linter" },
  { pattern: /^eslint\.config\.\w+$/, kind: "linter" },
  { pattern: /^\.prettierrc/, kind: "formatter" },
  { pattern: /^prettier\.config\.\w+$/, kind: "formatter" },
  { pattern: /^\.github[/\\]workflows[/\\]\w+\.yml$/, kind: "ci" },
  { pattern: /^\.gitlab-ci\.yml$/, kind: "ci" },
  { pattern: /^Dockerfile$/, kind: "docker" },
  { pattern: /^docker-compose\.\w+$/, kind: "docker" },
  { pattern: /^\.env(\.\w+)?$/, kind: "env" },
  { pattern: /^docs\.config\.\w+$/, kind: "other" },
];

const FRAMEWORK_INDICATORS: Array<{
  file: string;
  name: string;
  kind: FrameworkDetection["kind"];
}> = [
  { file: "next.config.js", name: "Next.js", kind: "next" },
  { file: "next.config.mjs", name: "Next.js", kind: "next" },
  { file: "next.config.ts", name: "Next.js", kind: "next" },
  { file: "nuxt.config.ts", name: "Nuxt", kind: "nuxt" },
  { file: "nuxt.config.js", name: "Nuxt", kind: "nuxt" },
  { file: "astro.config.mjs", name: "Astro", kind: "astro" },
  { file: "astro.config.ts", name: "Astro", kind: "astro" },
  { file: "vite.config.ts", name: "Vite", kind: "vite" },
  { file: "vite.config.js", name: "Vite", kind: "vite" },
  { file: "svelte.config.js", name: "SvelteKit", kind: "svelte" },
  { file: "angular.json", name: "Angular", kind: "angular" },
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  ".turbo",
  ".docs-cache",
  ".vetwo",
  "generated-docs",
  "__pycache__",
  ".cache",
  ".parcel-cache",
  ".vercel",
  ".netlify",
]);

const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db", ".gitkeep", ".npmrc", ".nvmrc"]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Analyzes a project directory to understand its structure, dependencies,
 * configuration, and source code. Uses filesystem traversal (not AST).
 * AST analysis is deferred to individual generators that need it.
 */
export function analyzeProject(rootDir: string): ProjectAnalysis {
  const packageInfo = readPackageJson(rootDir);
  const configFiles = discoverConfigFiles(rootDir);
  const sourceFiles = discoverSourceFiles(rootDir);
  const directoryTree = buildDirectoryTree(rootDir, rootDir, 0);
  const scripts = (packageInfo?.["scripts"] as Record<string, string>) ?? {};
  const dependencies = (packageInfo?.["dependencies"] as Record<string, string>) ?? {};
  const devDependencies = (packageInfo?.["devDependencies"] as Record<string, string>) ?? {};
  const framework = detectFramework(packageInfo);
  const projectType = detectProjectType(rootDir, packageInfo, sourceFiles);
  const packageManager = detectPackageManager(rootDir, configFiles);

  return {
    rootDir,
    packageInfo: packageInfo ? normalizePackageInfo(rootDir, packageInfo) : undefined,
    projectType,
    packageManager,
    sourceFiles,
    configFiles,
    directoryTree,
    publicExports: scanForExports(sourceFiles),
    scripts,
    dependencies,
    devDependencies,
    hasReadme: existsSync(join(rootDir, "README.md")),
    hasLicense: existsSync(join(rootDir, "LICENSE")) || existsSync(join(rootDir, "LICENSE.md")),
    hasDocker:
      existsSync(join(rootDir, "Dockerfile")) ||
      existsSync(join(rootDir, "docker-compose.yml")) ||
      existsSync(join(rootDir, "docker-compose.yaml")),
    hasCI:
      existsSync(join(rootDir, ".github", "workflows")) ||
      existsSync(join(rootDir, ".gitlab-ci.yml")),
    hasTests: sourceFiles.some((f) => f.path.includes(".test.") || f.path.includes(".spec.")),
    hasTypeScript:
      existsSync(join(rootDir, "tsconfig.json")) || existsSync(join(rootDir, "tsconfig.app.json")),
    framework,
  };
}

function readPackageJson(rootDir: string): Record<string, unknown> | undefined {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function normalizePackageInfo(rootDir: string, raw: Record<string, unknown>): PackageInfo {
  return {
    name: (raw["name"] as string) ?? "unknown",
    version: (raw["version"] as string) ?? "0.0.0",
    description: (raw["description"] as string) ?? "",
    path: rootDir,
    main: (raw["main"] as string) ?? undefined,
    module: (raw["module"] as string) ?? undefined,
    types: (raw["types"] as string) ?? (raw["typings"] as string) ?? undefined,
    exports:
      (raw["exports"] as Record<
        string,
        string | { import?: string; types?: string; require?: string }
      >) ?? undefined,
    files: Array.isArray(raw["files"]) ? (raw["files"] as string[]) : [],
  };
}

function discoverConfigFiles(rootDir: string): ConfigFile[] {
  const configs: ConfigFile[] = [];
  scanForConfigs(rootDir, rootDir, configs);
  return configs;
}

function scanForConfigs(baseDir: string, dir: string, result: ConfigFile[]): void {
  if (!existsSync(dir)) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry.startsWith(".") && entry !== ".github") continue;
        if (entry === ".github") {
          const workflowsDir = join(fullPath, "workflows");
          if (existsSync(workflowsDir)) {
            for (const wf of readdirSync(workflowsDir)) {
              if (wf.endsWith(".yml") || wf.endsWith(".yaml")) {
                result.push({
                  name: wf,
                  path: relative(baseDir, join(workflowsDir, wf)),
                  kind: "ci",
                });
              }
            }
          }
          continue;
        }
        scanForConfigs(baseDir, fullPath, result);
      } else if (stat.isFile()) {
        for (const { pattern, kind } of CONFIG_FILE_PATTERNS) {
          const relPath = relative(baseDir, fullPath);
          if (pattern.test(relPath) || pattern.test(entry)) {
            result.push({ name: entry, path: relPath, kind });
            break;
          }
        }
      }
    } catch {
      continue;
    }
  }
}

function discoverSourceFiles(rootDir: string): SourceFile[] {
  const files: SourceFile[] = [];
  scanForSource(rootDir, rootDir, files, 0);
  return files;
}

function scanForSource(baseDir: string, dir: string, result: SourceFile[], depth: number): void {
  if (depth > 10 || !existsSync(dir)) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry) || IGNORE_FILES.has(entry)) continue;
    if (entry.startsWith(".") && entry !== ".github") continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanForSource(baseDir, fullPath, result, depth + 1);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (SOURCE_EXTENSIONS.has(ext)) {
          const relPath = relative(baseDir, fullPath);
          result.push({
            path: fullPath,
            relativePath: relPath,
            extension: ext,
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    } catch {
      continue;
    }
  }
}

function scanForExports(sourceFiles: readonly SourceFile[]): PublicExport[] {
  const exports: PublicExport[] = [];
  const exportPattern =
    /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+(\w+)/gm;
  const constPattern = /^export\s+(?:const|let|var)\s+(\w+)/gm;

  for (const file of sourceFiles) {
    if (file.path.includes(".test.") || file.path.includes(".spec.")) continue;
    if (file.path.includes(".d.ts")) continue;
    let content: string;
    try {
      content = readFileSync(file.path, "utf-8");
    } catch {
      continue;
    }
    for (const match of content.matchAll(exportPattern)) {
      const name = match[1]!;
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      const lineEnd = content.indexOf("\n", match.index! + match[0].length);
      const signature = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      const kind = match[0].includes("function")
        ? "function"
        : match[0].includes("class")
          ? "class"
          : match[0].includes("interface")
            ? "interface"
            : match[0].includes("type")
              ? "type"
              : "enum";
      exports.push({
        name,
        kind,
        sourceFile: file.relativePath,
        description: "",
        signature,
        parameters: [],
        returnType: "",
        deprecated: false,
        since: undefined,
        examples: [],
        tags: [],
      });
    }
    for (const match of content.matchAll(constPattern)) {
      const name = match[1]!;
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      const lineEnd = content.indexOf("\n", match.index! + match[0].length);
      const signature = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      exports.push({
        name,
        kind: "const",
        sourceFile: file.relativePath,
        description: "",
        signature,
        parameters: [],
        returnType: "",
        deprecated: false,
        since: undefined,
        examples: [],
        tags: [],
      });
    }
  }
  return exports;
}

function buildDirectoryTree(baseDir: string, dir: string, depth: number): DirectoryNode {
  const name = basename(dir);
  const relPath = relative(baseDir, dir);
  if (depth > 5) {
    return { name, path: relPath || ".", type: "directory", children: [] };
  }
  const children: DirectoryNode[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith(".")) continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          children.push(buildDirectoryTree(baseDir, fullPath, depth + 1));
        } else if (stat.isFile() && !IGNORE_FILES.has(entry)) {
          children.push({
            name: entry,
            path: relative(baseDir, fullPath),
            type: "file",
            children: [],
            size: stat.size,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { name, path: relPath || ".", type: "directory", children };
}

function detectFramework(pkg: Record<string, unknown> | undefined): FrameworkDetection {
  if (pkg) {
    try {
      const allDeps = {
        ...((pkg["dependencies"] as Record<string, string>) ?? {}),
        ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
      };
      for (const indicator of FRAMEWORK_INDICATORS) {
        const indicatorName = indicator.file.replace(/\.\w+$/, "").replace(/\./g, "");
        if (allDeps[indicatorName]) {
          return { name: indicator.name, version: allDeps[indicatorName], kind: indicator.kind };
        }
      }
      if (allDeps["react"]) return { name: "React", version: allDeps["react"], kind: undefined };
      if (allDeps["vue"]) return { name: "Vue", version: allDeps["vue"], kind: undefined };
      if (allDeps["svelte"]) return { name: "Svelte", version: allDeps["svelte"], kind: undefined };
      if (allDeps["express"])
        return { name: "Express", version: allDeps["express"], kind: undefined };
      if (allDeps["fastify"])
        return { name: "Fastify", version: allDeps["fastify"], kind: undefined };
      if (allDeps["@nestjs/core"])
        return { name: "NestJS", version: allDeps["@nestjs/core"], kind: undefined };
      if (allDeps["hono"]) return { name: "Hono", version: allDeps["hono"], kind: undefined };
    } catch {
      // ignore
    }
  }
  return { name: undefined, version: undefined, kind: undefined };
}

function detectProjectType(
  rootDir: string,
  pkg: Record<string, unknown> | undefined,
  sourceFiles: SourceFile[],
): ProjectAnalysis["projectType"] {
  if (
    existsSync(join(rootDir, "pnpm-workspace.yaml")) ||
    existsSync(join(rootDir, "lerna.json")) ||
    existsSync(join(rootDir, "turbo.json")) ||
    existsSync(join(rootDir, "nx.json"))
  ) {
    return "monorepo";
  }
  if (pkg?.["workspaces"]) return "monorepo";
  const hasSrc = sourceFiles.some((f) => f.relativePath.startsWith("src/"));
  const hasBin = pkg?.["bin"] !== undefined;
  const hasMain =
    pkg?.["main"] !== undefined || pkg?.["module"] !== undefined || pkg?.["exports"] !== undefined;
  if (hasBin || (hasMain && hasSrc)) return "library";
  if (hasSrc) return "application";
  return "unknown";
}

function detectPackageManager(
  rootDir: string,
  configs: ConfigFile[],
): ProjectAnalysis["packageManager"] {
  if (configs.some((c) => c.name === "pnpm-workspace.yaml")) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "bun.lockb"))) return "bun";
  return "npm";
}
