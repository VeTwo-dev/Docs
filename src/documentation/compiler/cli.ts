/**
 * Documentation Compiler CLI Commands.
 *
 * Registers `docs plan`, `docs analyze`, `docs coverage`, and `docs diff`.
 * These surface the knowledge compiler's deterministic output; they never
 * mutate user documentation.
 */

import type { Command } from "commander";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { CompilerProjectInput, DocumentationArchitecture } from "./types.js";
import {
  compileDocumentation,
  planCompilation,
  computePageFingerprints,
  type SnapshotStore,
} from "./index.js";
import type { DocumentationDiagnostic } from "./diagnostics.js";
import type { DocumentationSnapshot } from "./orchestrator.js";

interface LoggerLike {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  table(headers: string[], rows: string[][]): void;
}

/** Build a CompilerProjectInput from the project's package.json. */
export function buildCompilerInput(rootDir: string): CompilerProjectInput {
  const pkgPath = join(rootDir, "package.json");
  let pkg: {
    name?: string;
    version?: string;
    description?: string;
    bin?: unknown;
    workspaces?: unknown;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  } = {};
  if (existsSync(pkgPath)) {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  }

  const deps = Object.keys(pkg.dependencies ?? {});
  const allDeps = [...deps, ...Object.keys(pkg.devDependencies ?? {})];

  return {
    rootDir,
    name: pkg.name ?? "project",
    description: pkg.description,
    version: pkg.version,
    signals: {
      hasBin: pkg.bin !== undefined,
      hasCli: pkg.bin !== undefined,
      hasServer: pkg.scripts?.["start"] !== undefined || deps.includes("express"),
      isMonorepo: pkg.workspaces !== undefined,
      framework: ["next", "nuxt", "remix", "astro"].find((d) => allDeps.includes(d)),
      dependencies: deps,
      peerDependencies: Object.keys(pkg.peerDependencies ?? {}),
    },
  };
}

/** File-backed snapshot store under `.vetwo/docs/snapshots/`. */
function createFsSnapshotStore(rootDir: string): SnapshotStore {
  const dir = join(rootDir, ".vetwo", "docs", "snapshots");
  const file = join(dir, "latest.json");
  return {
    load() {
      if (!existsSync(file)) return undefined;
      try {
        const raw = JSON.parse(readFileSync(file, "utf-8")) as Partial<DocumentationSnapshot>;
        if (raw.pages === undefined) return undefined;
        return {
          createdAt: raw.createdAt ?? "",
          architectureFingerprint: raw.architectureFingerprint ?? "",
          pages: raw.pages,
          navigationOrder: raw.navigationOrder ?? [],
        } as DocumentationSnapshot;
      } catch {
        return undefined;
      }
    },
    save(snapshot) {
      mkdirSync(dir, { recursive: true });
      // Store the lean baseline (fingerprints + nav order), not the full body.
      const lean = {
        createdAt: snapshot.createdAt,
        architectureFingerprint: snapshot.architectureFingerprint,
        pages: snapshot.pages,
        navigationOrder: snapshot.navigationOrder,
      };
      writeFileSync(file, JSON.stringify(lean), "utf-8");
    },
    history: () => [],
  };
}

const SEVERITY_ICON: Record<string, string> = {
  error: "\x1b[31m✗\x1b[0m",
  warning: "\x1b[33m!\x1b[0m",
  info: "\x1b[36mi\x1b[0m",
};

/** Register the compiler command group on a commander program. */
export function registerCompilerCommands(
  program: Command,
  options: {
    logger: LoggerLike;
    findRootDir(): string;
  },
): void {
  const { logger, findRootDir } = options;

  const renderDiagnostics = (diagnostics: readonly DocumentationDiagnostic[]): void => {
    if (diagnostics.length === 0) {
      logger.success("No issues found");
      return;
    }
    logger.table(
      ["Severity", "Code", "Message"],
      diagnostics.map((d) => [SEVERITY_ICON[d.severity] ?? d.severity, d.code, d.message]),
    );
  };

  const renderArchitectureSummary = (architecture: DocumentationArchitecture): void => {
    logger.info(`Archetypes: ${architecture.project.archetypes.join(" + ")}`);
    logger.info(
      `Personas: ${architecture.project.personas.map((p) => `${p.persona} (#${p.priority})`).join(", ")}`,
    );
    logger.info(`Coverage: ${(architecture.coverage.score * 100).toFixed(0)}%`);
    logger.info("");
    for (const section of architecture.sections) {
      logger.info(`${section.title}`);
      for (const slug of section.pages) {
        const page = architecture.pages.find((p) => p.slug === slug);
        logger.info(
          `  - ${slug}${page?.title !== slug && page !== undefined ? ` (${page.title})` : ""}`,
        );
      }
    }
  };

  program
    .command("plan")
    .description("Compile and display the inferred documentation architecture")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const rootDir = findRootDir();
      const input = buildCompilerInput(rootDir);
      const { architecture, ir, diagnostics } = compileDocumentation(input);

      if (options.json === true) {
        logger.info(JSON.stringify({ architecture, ir, diagnostics }, null, 2));
        return;
      }
      renderArchitectureSummary(architecture);
      logger.info("");
      logger.info(`IR pages: ${ir.pages.length} (schema v${ir.schemaVersion})`);
      logger.info("");
      renderDiagnostics(diagnostics);
    });

  program
    .command("analyze")
    .description("Analyze the project: archetype, personas, and documentation gaps")
    .action(() => {
      const rootDir = findRootDir();
      const input = buildCompilerInput(rootDir);
      const { architecture, diagnostics } = compileDocumentation(input);
      renderArchitectureSummary(architecture);
      logger.info("");
      const gapCount = diagnostics.filter((d) => d.code === "DOC_UNDOCUMENTED_PUBLIC_API").length;
      if (gapCount > 0) logger.warn(`${gapCount}+ undocumented public items detected`);
      renderDiagnostics(diagnostics);
    });

  program
    .command("coverage")
    .description("Show documentation coverage by area")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const rootDir = findRootDir();
      const input = buildCompilerInput(rootDir);
      const { architecture } = compileDocumentation(input);

      if (options.json === true) {
        logger.info(JSON.stringify(architecture.coverage, null, 2));
        return;
      }
      logger.info(`Overall coverage: ${(architecture.coverage.score * 100).toFixed(0)}%\n`);
      const rows = architecture.coverage.areas.map((area) => [
        area.area,
        String(area.documented.length),
        String(area.gaps.length),
        area.gaps.slice(0, 3).join(", ") || "-",
      ]);
      if (rows.length === 0) {
        logger.info("No coverage areas computed for this project yet.");
        return;
      }
      logger.table(["Area", "Documented", "Gaps", "Top gaps"], rows);
    });

  program
    .command("render")
    .description("Render the compiled documentation IR as a static site")
    .option("--target <target>", "Renderer target (nextjs)", "nextjs")
    .option("-o, --out <directory>", "Output directory", "documentation-site")
    .action((options: { target: string; out: string }) => {
      const rootDir = findRootDir();
      if (options.target !== "nextjs") {
        logger.error(`Unknown render target: ${options.target}`);
        return;
      }
      const input = buildCompilerInput(rootDir);
      const { ir } = compileDocumentation(input);

      import("../../renderers/index.js")
        .then(({ createNextJsRenderer, writeRenderedSite }) => {
          const renderer = createNextJsRenderer();
          const site = renderer.render(ir, {
            siteName: input.name,
            description: input.description,
            docsBasePath: "/docs",
          });
          const outDir = resolve(rootDir, options.out);
          const written = writeRenderedSite(site, outDir);
          logger.success(`Rendered ${written.length} files to ${options.out}/`);
          logger.info(`Entrypoint: ${site.entrypoint}`);
          logger.info("Next steps: npm install && npm run dev inside the output directory");
        })
        .catch((error: unknown) => {
          logger.error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    });

  program
    .command("validate-output")
    .description("Validate the generated documentation workspace (boundaries, routes, links, assets, CSS, search)")
    .option("-o, --out <directory>", "Workspace directory (resolved from config when omitted)")
    .option("--json", "Output as JSON")
    .action(async (options: { out?: string; json?: boolean }) => {
      const rootDir = findRootDir();
      const { validateWorkspace } = await import("./validate-output.js");
      let outDir = options.out;
      if (outDir === undefined) {
        try {
          const { loadConfig } = await import("../../config/index.js");
          const { config } = await loadConfig(rootDir);
          const { resolveOutputDirectory } = await import("../../config/resolve.js");
          outDir = resolveOutputDirectory(config);
        } catch {
          outDir = "docs";
        }
      }
      const result = validateWorkspace(rootDir, resolve(rootDir, outDir));
      if (options.json === true) {
        logger.info(JSON.stringify(result, null, 2));
      } else if (result.errors.length === 0 && result.warnings.length === 0) {
        logger.success(`Output valid: ${result.pages} pages, ${result.routes} routes, ${result.assets} assets`);
      } else {
        for (const e of result.errors) logger.error(`✗ ${e}`);
        for (const w of result.warnings) logger.warn(`⚠ ${w}`);
        logger.info(`Pages: ${result.pages}, routes: ${result.routes}, assets: ${result.assets}`);
      }
      if (result.errors.length > 0) process.exit(1);
    });

  program
    .command("diff")
    .description("Diff the current inferred architecture against the last saved plan")
    .option("--save", "Persist the current plan as the new baseline")
    .action((options: { save?: boolean }) => {
      const rootDir = findRootDir();
      const input = buildCompilerInput(rootDir);
      const store = createFsSnapshotStore(rootDir);
      const { changes } = planCompilation(input, store);

      if (changes.isEmpty) {
        logger.success("No documentation changes since the last plan.");
      } else {
        if (changes.addedPages.length > 0) {
          logger.info(`Added pages: ${changes.addedPages.join(", ")}`);
        }
        if (changes.removedPages.length > 0) {
          logger.warn(`Removed pages: ${changes.removedPages.join(", ")}`);
        }
        if (changes.updatedPages.length > 0) {
          logger.info(`Updated pages: ${changes.updatedPages.join(", ")}`);
        }
        if (changes.navigationChanged) {
          logger.info("Navigation changed.");
        }
        if (changes.architectureChanged) {
          logger.warn("Project architecture changed (archetype shift).");
        }
      }

      if (options.save === true) {
        const { architecture } = compileDocumentation(input);
        const dir = join(rootDir, ".vetwo", "docs", "snapshots");
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "latest.json"),
          JSON.stringify({
            createdAt: new Date().toISOString(),
            architectureFingerprint: "",
            pages: computePageFingerprints(architecture),
            navigationOrder: architecture.navigation.sidebar.flatMap((n) => [
              n.label,
              ...(n.children ?? []).map((c) => c.label),
            ]),
          }),
          "utf-8",
        );
        logger.success("Baseline saved to .vetwo/docs/snapshots/latest.json");
      }
    });
}
