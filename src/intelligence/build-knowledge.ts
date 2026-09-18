/**
 * Project Knowledge Builder (Phase 22).
 * Deterministically builds ProjectKnowledge from rootDir + API symbols + graph + signals.
 * No AI — facts only; AI may enrich later via provider.
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverIdentity } from "./discovery/identity.js";
import { discoverPurpose } from "./discovery/purpose.js";
import type { ProjectKnowledge } from "./knowledge.js";
import type { CompilerProjectInput, SymbolBoundary } from "../documentation/compiler/types.js";
import type { ApiSymbol } from "../api/models.js";
import type { KnowledgeGraph } from "../graph/index.js";

export interface BuildKnowledgeInput {
  readonly rootDir: string;
  readonly apiSymbols?: readonly ApiSymbol[];
  readonly graph?: KnowledgeGraph;
  readonly signals?: {
    commands?: readonly { name: string; description?: string }[];
    configKeys?: readonly string[];
    examples?: readonly string[];
    hasBin?: boolean;
    isMonorepo?: boolean;
    framework?: string;
  };
  readonly packageJson?: Record<string, unknown>;
}

/**
 * Builds deterministic project knowledge from the repository (no AI).
 *
 * @param input - Root directory, optional API symbols, graph and signals.
 * @returns Complete project knowledge model for the documentation compiler.
 */
export async function buildProjectKnowledge(input: BuildKnowledgeInput): Promise<ProjectKnowledge> {
  const identity = discoverIdentity(input.rootDir, {
    framework: input.signals?.framework,
    hasBin: input.signals?.hasBin,
    isMonorepo: input.signals?.isMonorepo,
  });
  const purposeRaw = discoverPurpose(input.rootDir, identity.description);
  const pkgName = identity.packageName;
  const pm = identity.packageManager;
  const installMap: Record<string, string> = {
    npm: `npm install ${pkgName}`,
    pnpm: `pnpm add ${pkgName}`,
    yarn: `yarn add ${pkgName}`,
    bun: `bun add ${pkgName}`,
  };

  // Wire API symbols via semantic analyzer if not provided (best-effort, never throws)
  let apiSymbols = input.apiSymbols;
  if (apiSymbols === undefined) {
    try {
      const { analyzeAPIs } = await import("../api/analyzer.js");
      const result = await analyzeAPIs({
        rootDir: input.rootDir,
        exclude: [
          "**/*.test.*",
          "**/*.spec.*",
          "**/__tests__/**",
          "fixtures/**",
          "docs/**",
          "dist/**",
          "node_modules/**",
        ],
      });
      apiSymbols = result.symbols
        .filter((s) => s.boundary === "public" || s.boundary === "semi-public")
        .slice(0, 500);
    } catch {
      apiSymbols = [];
    }
  }

  // Real package.json scripts for development docs
  let scripts: Record<string, string> =
    (input.packageJson?.["scripts"] as Record<string, string> | undefined) ?? {};
  if (Object.keys(scripts).length === 0) {
    try {
      const pkg = JSON.parse(readFileSync(join(input.rootDir, "package.json"), "utf8")) as Record<
        string,
        unknown
      >;
      scripts = (pkg["scripts"] as Record<string, string> | undefined) ?? {};
    } catch {
      // Best-effort discovery — ignore unreadable entries.
    }
  }

  // Classify scripts into buckets (development/testing/validation/build/publishing)
  const scriptBuckets: Record<string, readonly string[]> = {
    development: [],
    testing: [],
    validation: [],
    build: [],
    publishing: [],
    maintenance: [],
  };
  {
    const mutable = scriptBuckets as Record<string, string[]>;
    for (const [name, cmd] of Object.entries(scripts)) {
      const c = `${name} ${cmd}`.toLowerCase();
      if (/test|vitest|jest|playwright|cypress/.test(c)) mutable["testing"]!.push(name);
      else if (/lint|typecheck|format|check/.test(c)) mutable["validation"]!.push(name);
      else if (/build|compile|tsup|vite|webpack/.test(c)) mutable["build"]!.push(name);
      else if (/publish|release|version|changeset/.test(c)) mutable["publishing"]!.push(name);
      else if (/dev|start|watch|serve/.test(c)) mutable["development"]!.push(name);
      else mutable["maintenance"]!.push(name);
    }
  }
  const testRunner = scripts["test"]?.includes("vitest")
    ? "vitest"
    : scripts["test"]?.includes("jest")
      ? "jest"
      : scripts["test"]
        ? "npm test"
        : undefined;
  const buildSystem = scripts["build"]?.includes("tsup")
    ? "tsup"
    : scripts["build"]?.includes("vite")
      ? "vite"
      : scripts["build"]
        ? "npm run build"
        : undefined;

  return {
    identity,
    purpose: {
      summary: purposeRaw.summary,
      capabilities: purposeRaw.capabilities,
      audiences: purposeRaw.audiences,
      confidence: "repository-derived",
    },
    installation: {
      packageManager: pm,
      installCommand: installMap[pm] ?? `npm install ${pkgName}`,
      runtimeRequirements: identity.runtime ? [identity.runtime] : ["Node.js >= 20"],
    },
    configuration: {
      configFiles: ["docs.config.ts", "package.json"],
      configKeys: (input.signals?.configKeys ?? []).map((k) => ({ key: k })),
      envVars: [],
    },
    api: { symbols: apiSymbols ?? [] },
    cli: {
      commands: (input.signals?.commands ?? []).map((c) => ({
        name: c.name,
        description: c.description,
      })),
    },
    architecture: discoverArchitecture(input.rootDir),
    dependencies: { runtime: [], peer: [], dev: [], important: [] },
    environment: [],
    examples: {
      discovered: (input.signals?.examples ?? []).map((e) => ({
        title: e,
        source: "examples" as const,
      })),
    },
    development: { scripts, testRunner, buildSystem, scriptBuckets },
    graph: input.graph,
    raw: { packageJson: input.packageJson, readmeExcerpt: purposeRaw.summary },
  };
}

/**
 * Discover real architecture modules from the project's source tree.
 * Evidence: top-level source directories + their exported names (parsed from
 * source text, bounded). Never hardcoded per-project structure.
 */
function discoverArchitecture(rootDir: string): ProjectKnowledge["architecture"] {
  const modules: { path: string; responsibility: string }[] = [];
  const structure: { path: string; explanation: string }[] = [];
  try {
    const srcDir = join(rootDir, "src");
    const entries: string[] = existsSync(srcDir) ? readdirSync(srcDir) : [];
    const dirs = entries
      .filter((e) => {
        try {
          return statSync(join(srcDir, e)).isDirectory();
        } catch {
          return false;
        }
      })
      .slice(0, 12);
    if (dirs.length === 0) {
      // Single-level src: treat index files as the module surface.
      const files = entries.filter((e) => /\.(ts|js|tsx|jsx)$/.test(e)).slice(0, 20);
      if (files.length > 0) {
        const names = files.flatMap((f) => extractExportedNames(join(srcDir, f))).slice(0, 8);
        modules.push({
          path: "src/",
          responsibility:
            names.length > 0
              ? `Exports ${names.join(", ")}`
              : `Source entry (${files.length} files)`,
        });
      }
    }
    for (const dir of dirs) {
      const dirPath = join(srcDir, dir);
      let files: string[] = [];
      try {
        files = readdirSync(dirPath).filter((f: string) => /\.(ts|js|tsx|jsx)$/.test(f));
      } catch {
        files = [];
      }
      const names = files
        .slice(0, 10)
        .flatMap((f) => extractExportedNames(join(dirPath, f)))
        .slice(0, 6);
      modules.push({
        path: `src/${dir}`,
        responsibility:
          names.length > 0
            ? `Exports ${names.join(", ")}${files.length > 10 ? ` (+${files.length - 10} more files)` : ""}`
            : `Source module (${files.length} files)`,
      });
      structure.push({ path: `src/${dir}/`, explanation: `${files.length} source files` });
    }
    structure.unshift({ path: "src/", explanation: "Source" });
  } catch {
    // Fall through to minimal fallback.
  }
  if (modules.length === 0) {
    modules.push({ path: "src/", responsibility: "Source" });
    structure.push({ path: "src/", explanation: "Source" });
  }
  const nodeIds = modules.map((_, i) => `M${i}`);
  const mermaid = ["graph TD", ...modules.map((m, i) => `  ${nodeIds[i]}["${m.path}"]`)].join("\n");
  return {
    modules,
    mermaidDiagrams: [{ title: "System", code: mermaid }],
    directoryStructure: structure,
  };
}

/** Extract exported identifier names from source text (bounded, syntactic only). */
function extractExportedNames(file: string): string[] {
  try {
    const text = readFileSync(file, "utf8");
    const names: string[] = [];
    const re =
      /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && names.length < 8) {
      if (m[1] !== undefined) names.push(m[1]);
    }
    return names;
  } catch {
    return [];
  }
}

/** Map ProjectKnowledge to CompilerProjectInput (reuse existing pipeline). */
export function knowledgeToCompilerInput(
  knowledge: ProjectKnowledge,
  rootDir: string,
): CompilerProjectInput {
  return {
    rootDir,
    // Use full packageName so install/quick-start emit `npm install @scope/name`, not bare displayName
    name: knowledge.identity.packageName,
    description: knowledge.identity.description ?? knowledge.purpose.summary,
    version: knowledge.identity.version,
    signals: {
      hasBin: knowledge.cli.commands.length > 0,
      hasCli: knowledge.cli.commands.length > 0,
      isMonorepo: knowledge.identity.isMonorepo,
      framework: knowledge.identity.framework,
      configKeys: knowledge.configuration.configKeys.map((k) => k.key),
      commands: knowledge.cli.commands.map((c) => ({ name: c.name, description: c.description })),
      examples: knowledge.examples.discovered.map((e) => e.title),
      scripts: Object.keys(knowledge.development.scripts),
    },
    apis: knowledge.api.symbols.map((s) => ({
      name: s.name,
      kind: s.kind,
      signature: s.returnType,
      description: s.documentation.summary,
      sourceFile: s.sourceFile,
      boundary: s.boundary as SymbolBoundary,
      deprecated: s.deprecated !== false,
    })),
    apiSymbols: knowledge.api.symbols as unknown as CompilerProjectInput["apiSymbols"],
    concepts: knowledge.architecture.modules.map((m) => ({
      name: m.path,
      kind: "module",
      description: m.responsibility,
    })),
  };
}
