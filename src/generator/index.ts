import type {
  GeneratorConfigInput,
  GeneratedPage,
  GenerationResult,
  GenerationStats,
  GeneratorContext,
  ProjectAnalysis,
} from "./core/types.js";
import type { Logger } from "../types/internal.js";
import { resolveGeneratorConfig } from "./core/config.js";
import { analyzeProject } from "../analyzer/index.js";
import { runPageGenerators, runMetadataGenerators } from "./pages/index.js";
import { writeGeneratedOutput, cleanGeneratedOutput } from "./writers.js";
import { GeneratorCache } from "./cache.js";
import { resolveOutputDirectory } from "../config/resolve.js";
import { join } from "node:path";

/** Options for running the documentation generator. */
export interface GenerateOptions {
  readonly rootDir: string;
  readonly logger: Logger;
  readonly generatorConfig?: GeneratorConfigInput;
  readonly clean?: boolean;
  readonly overwrite?: boolean;
  readonly apiOnly?: boolean;
  readonly examplesOnly?: boolean;
  readonly changedOnly?: boolean;
}

/**
 * Runs the automatic documentation generator.
 * Analyzes the project, generates documentation pages and metadata,
 * and writes them to disk.
 */
export async function generateDocs(options: GenerateOptions): Promise<GenerationResult> {
  const {
    rootDir,
    logger,
    clean: cleanMode = false,
    overwrite = false,
    apiOnly = false,
    examplesOnly = false,
    changedOnly = false,
  } = options;

  const startTime = performance.now();

  // Resolve config
  let genConfig = resolveGeneratorConfig(options.generatorConfig);
  if (overwrite) {
    genConfig = { ...genConfig, overwrite: true };
  }
  if (apiOnly) {
    genConfig = {
      ...genConfig,
      api: true,
      architecture: false,
      guides: false,
      configuration: false,
      cli: false,
      faq: false,
      troubleshooting: false,
      examples: false,
      recipes: false,
      changelog: false,
    };
  }
  if (examplesOnly) {
    genConfig = {
      ...genConfig,
      api: false,
      architecture: false,
      guides: false,
      configuration: false,
      cli: false,
      faq: false,
      troubleshooting: false,
      examples: true,
      recipes: true,
      changelog: false,
    };
  }

  const outputDir = join(rootDir, resolveOutputDirectory(genConfig));

  // Clean mode
  if (cleanMode) {
    logger.info("Cleaning generated docs...");
    cleanGeneratedOutput(outputDir);
    logger.success("Cleaned generated docs");
  }

  // Analyze project
  logger.info("Analyzing project...");
  const analysis = analyzeProject(rootDir);
  logAnalysis(analysis, logger);

  // Build generator context
  const ctx: GeneratorContext = {
    analysis,
    config: genConfig,
    rootDir,
    outputDir,
  };

  // Generate pages
  logger.info("Generating documentation pages...");
  let pages = runPageGenerators(ctx);
  logger.info(`  Generated ${pages.length} pages`);

  // Generate metadata
  logger.info("Generating metadata...");
  const metadata = runMetadataGenerators(ctx, pages);
  logger.info(`  Generated ${metadata.length} metadata files`);

  // Incremental filtering
  let cacheHits = 0;
  let cacheMisses = 0;
  const cache = new GeneratorCache(rootDir);
  let filteredMetadataResult = metadata;
  if (changedOnly && !genConfig.overwrite) {
    const filteredPages: GeneratedPage[] = [];
    for (const page of pages) {
      if (!cache.isUpToDate(page.slug, page.content)) {
        filteredPages.push(page);
      } else {
        cacheHits++;
      }
    }
    cacheMisses = filteredPages.length;
    pages = filteredPages;
    logger.info(`  Incremental: ${cacheHits} cached, ${cacheMisses} to generate`);

    filteredMetadataResult = metadata.filter((m) => !cache.isUpToDate(m.filename, m.content));
  }

  // Write output
  logger.info("Writing generated files...");
  const { written, skipped } = writeGeneratedOutput(
    outputDir,
    pages,
    filteredMetadataResult,
    genConfig.overwrite,
  );
  logger.info(`  Written: ${written}, Skipped: ${skipped}`);

  // Always record in cache (both incremental and full runs)
  for (const page of pages) {
    cache.record(page.slug, page.content);
  }
  for (const meta of filteredMetadataResult) {
    cache.record(meta.filename, meta.content);
  }
  cache.save();

  const duration = performance.now() - startTime;
  const stats: GenerationStats = {
    totalPages: pages.length,
    totalMetadata: filteredMetadataResult.length,
    filesScanned: analysis.sourceFiles.length,
    exportsFound: analysis.publicExports.length,
    duration,
    incremental: changedOnly,
    cacheHits,
    cacheMisses,
  };

  logger.success(`Documentation generated in ${(duration / 1000).toFixed(2)}s`);

  return { pages, metadata: filteredMetadataResult, stats };
}

function logAnalysis(analysis: ProjectAnalysis, logger: Logger): void {
  logger.info(`  Project type: ${analysis.projectType}`);
  logger.info(`  Package manager: ${analysis.packageManager}`);
  if (analysis.packageInfo) {
    logger.info(`  Package: ${analysis.packageInfo.name}@${analysis.packageInfo.version}`);
  }
  if (analysis.framework.name) {
    logger.info(`  Framework: ${analysis.framework.name}`);
  }
  logger.info(`  Source files: ${analysis.sourceFiles.length}`);
  logger.info(`  Config files: ${analysis.configFiles.length}`);
  logger.info(`  Has TypeScript: ${analysis.hasTypeScript}`);
  logger.info(`  Has Tests: ${analysis.hasTests}`);
  logger.info(`  Has CI: ${analysis.hasCI}`);
  logger.info(`  Has Docker: ${analysis.hasDocker}`);
}

export type {
  GeneratorConfig,
  GeneratorConfigInput,
  GenerationResult,
  GenerationStats,
} from "./core/types.js";
