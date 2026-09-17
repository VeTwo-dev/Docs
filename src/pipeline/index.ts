import type { BuildContextMutable, FeatureGenerator } from "../types/internal.js";
import type { Logger } from "../types/internal.js";
import type { Plugin } from "../types/internal.js";
import type { LifecycleHookName } from "../types/public.js";
import { createHookRegistry, type HookRegistry } from "../hooks/index.js";
import {
  processMarkdownFiles,
  generateNavigation,
  generateSidebar,
  generateSearchIndex,
  writeSearchIndex,
  generateSitemap,
  writeSitemap,
  writeRobotsTxt,
  generateRssFeed,
  writeRssFeed,
  writePages,
  generateOgImages,
} from "../features/index.js";

/** Build metrics collected during a pipeline run. */
export interface BuildMetrics {
  readonly totalDuration: number;
  readonly stages: readonly { name: string; duration: number }[];
  readonly pages: number;
  readonly errors: number;
  readonly warnings: number;
  readonly timestamp: string;
}

/** A build pipeline that orchestrates lifecycle stages and built-in features. */
export interface Pipeline {
  /** Runs the full documentation generation pipeline against the given context. */
  run(ctx: BuildContextMutable): Promise<BuildMetrics>;
}

interface PipelineOptions {
  readonly logger: Logger;
  readonly plugins: readonly Plugin[];
}

/**
 * Creates a new {@link Pipeline} that runs documentation generation stages sequentially,
 * including plugin hooks and built-in feature generators.
 *
 * @param options - Configuration for the pipeline, including logger and plugins.
 * @returns A new Pipeline instance.
 *
 * @example
 * ```ts
 * const pipeline = createPipeline({ logger, plugins });
 * await pipeline.run(ctx);
 * ```
 */
export function createPipeline(options: PipelineOptions): Pipeline {
  const { logger, plugins } = options;
  const hooks = createHookRegistry();

  for (const plugin of plugins) {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      hooks.register(hookName as LifecycleHookName, handler);
    }
  }

  const builtInFeatures: FeatureGenerator[] = [
    {
      name: "markdown",
      enabled: () => true,
      generate: processMarkdownFiles,
    },
    {
      name: "navigation",
      enabled: () => true,
      generate: (ctx) => {
        generateNavigation(ctx);
        generateSidebar(ctx);
      },
    },
    {
      name: "search",
      enabled: (config) => config.search.enabled,
      generate: generateSearchIndex,
    },
    {
      name: "sitemap",
      enabled: (config) => config.sitemap,
      generate: generateSitemap,
    },
    {
      name: "rss",
      enabled: (config) => config.rss,
      generate: generateRssFeed,
    },
    {
      name: "og-images",
      enabled: (config) => config.og !== false,
      generate: generateOgImages,
    },
    {
      name: "output",
      enabled: () => true,
      generate: async (ctx) => {
        writePages(ctx);
        writeSearchIndex(ctx);
        await writeSitemap(ctx);
        writeRobotsTxt(ctx);
        await writeRssFeed(ctx);
      },
    },
  ];

  return {
    async run(ctx: BuildContextMutable): Promise<BuildMetrics> {
      const startTime = performance.now();
      const stages: { name: string; duration: number }[] = [];

      logger.info("Starting documentation generation pipeline");

      // Stage 1: Init
      await executeStageWithTiming("init", hooks, ctx, logger, stages);

      // Stage 2: Discover
      await executeStageWithTiming("discover", hooks, ctx, logger, stages);

      // Stage 3: Config
      await executeStageWithTiming("config", hooks, ctx, logger, stages);

      // Stage 4: Load
      await executeStageWithTiming("load", hooks, ctx, logger, stages);

      // Stage 5: Transform (process content)
      await executeStageWithTiming("transform", hooks, ctx, logger, stages);

      // Stage 6: Generate (built-in features)
      const generateStart = performance.now();
      for (const feature of builtInFeatures) {
        if (feature.enabled(ctx.config)) {
          logger.debug(`Running feature: ${feature.name}`);
          await feature.generate(ctx);
        }
      }
      stages.push({ name: "generate", duration: performance.now() - generateStart });

      // Stage 6b: Plugin generate hooks
      await executeStageWithTiming("generate", hooks, ctx, logger, stages);

      // Stage 7: Output
      await executeStageWithTiming("output", hooks, ctx, logger, stages);

      // Stage 8: Done
      await executeStageWithTiming("done", hooks, ctx, logger, stages);

      const totalDuration = performance.now() - startTime;
      const seconds = (totalDuration / 1000).toFixed(2);
      logger.success(`Documentation generated in ${seconds}s`);
      logger.info(`  Pages: ${ctx.pages.length}`);
      logger.info(`  Output: ${ctx.outputDir}`);

      if (process.env["VETWO_LOG_LEVEL"] === "debug") {
        logger.info("  Stage timings:");
        for (const stage of stages) {
          logger.info(`    ${stage.name}: ${(stage.duration / 1000).toFixed(3)}s`);
        }
      }

      if (ctx.warnings.length > 0) {
        logger.warn(`${ctx.warnings.length} warning(s)`);
      }
      if (ctx.errors.length > 0) {
        logger.error(`${ctx.errors.length} error(s)`);
      }

      return {
        totalDuration,
        stages,
        pages: ctx.pages.length,
        errors: ctx.errors.length,
        warnings: ctx.warnings.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

async function executeStage(
  hook: LifecycleHookName,
  hookRegistry: HookRegistry,
  ctx: BuildContextMutable,
  logger: Logger,
): Promise<void> {
  const handlers = hookRegistry.getAll(hook);
  if (handlers.length === 0) return;

  logger.debug(`Executing stage: ${hook} (${handlers.length} handler(s))`);

  for (const handler of handlers) {
    await handler({ ctx, config: ctx.config, log: logger });
  }
}

async function executeStageWithTiming(
  hook: LifecycleHookName,
  hookRegistry: HookRegistry,
  ctx: BuildContextMutable,
  logger: Logger,
  stages: { name: string; duration: number }[],
): Promise<void> {
  const start = performance.now();
  await executeStage(hook, hookRegistry, ctx, logger);
  stages.push({ name: hook, duration: performance.now() - start });
}
