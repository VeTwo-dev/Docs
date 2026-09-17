import type { Logger } from "../types/internal.js";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocsConfig } from "../config/types.js";
import { resolveOutputDirectory } from "../config/resolve.js";
import type { ProjectDetection } from "../scanner/project.js";
import type { ProjectModel } from "../scanner/models/project.js";
import type { ScannerScanOptions } from "../scanner/engine/engine.js";
import type { ProjectAnalysis } from "../generator/types.js";
import { createBuildContext } from "../pipeline/context.js";
import { createPipeline } from "../pipeline/index.js";
import { generateDocs } from "../generator/index.js";
import type { GenerateOptions, GenerationResult } from "../generator/index.js";
import { analyzeProject } from "../analyzer/index.js";
import { createLanguageManager, type LanguageManager } from "../languages/index.js";
import { createCompilerManager, type CompilerManager } from "../compiler/index.js";
import { createSymbolEngine, type SymbolEngine } from "../symbols/index.js";
import { createReferenceEngine, type ReferenceEngine } from "../references/index.js";
import { createGraphEngine, type GraphEngine } from "../graph/index.js";
import { ensureDir } from "../filesystem/index.js";
import { ServiceContainer } from "./container.js";
import {
  LOGGER_SERVICE,
  loggerServiceFactory,
  PROJECT_SERVICE,
  projectServiceFactory,
  CONFIG_SERVICE,
  configServiceFactory,
  CACHE_SERVICE,
  cacheServiceFactory,
  PLUGIN_SERVICE,
  pluginServiceFactory,
  THEME_SERVICE,
  themeServiceFactory,
  DISCOVERY_SERVICE,
  discoveryServiceFactory,
  OUTPUT_SERVICE,
  outputServiceFactory,
} from "./services/index.js";
import type {
  LoggerService,
  ProjectService,
  ConfigService,
  CacheService,
  PluginService,
  DiscoveryService,
} from "./services/index.js";

/** Options for running a documentation build. */
export interface BuildOptions {
  readonly rootDir: string;
  readonly configPath?: string;
  readonly logger: Logger;
}

/** Options for creating a {@link DocsEngine} instance. */
export interface EngineOptions {
  /** The project root directory. Falls back to `process.cwd()`. */
  readonly rootDir?: string;
  /** An explicit configuration file path override. */
  readonly configPath?: string;
  /** A logger to use for engine output. Falls back to a fresh console logger. */
  readonly logger?: Logger;
}

/** Result of {@link DocsEngine.initialize}. */
export interface InitializeResult {
  readonly config: DocsConfig;
  readonly detection: ProjectDetection;
  readonly cacheEnabled: boolean;
}

/**
 * The documentation engine.
 *
 * Composes the layered subsystems (config, scanner, pipeline, generator,
 * analyzer, plugins, themes, cache, output) behind a single lifecycle:
 * `createDocsEngine()` → `initialize()` → `build()` → `dispose()`.
 *
 * The pipeline, generator and analyzer can also be executed independently
 * through {@link DocsEngine.runPipeline}, {@link DocsEngine.runGenerator} and
 * {@link DocsEngine.runAnalyzer}.
 */
export interface DocsEngine {
  /** The engine's service container. */
  readonly services: ServiceContainer;
  /**
   * Loads configuration and project context. Idempotent — subsequent calls
   * are no-ops until {@link DocsEngine.dispose} is called.
   */
  initialize(options?: { rootDir?: string; configPath?: string }): Promise<InitializeResult>;
  /** Runs a full documentation build. */
  build(options?: BuildOptions): Promise<void>;
  /** Runs the pipeline against a pre-built context. */
  runPipeline(ctx: BuildContextMutable): Promise<void>;
  /** Runs the documentation generator subsystem standalone. */
  runGenerator(options: GenerateOptions): Promise<GenerationResult>;
  /** Runs project analysis standalone. */
  runAnalyzer(rootDir: string): ProjectAnalysis;
  /** Runs the universal scanner and returns the unified project index. */
  runScanner(rootDir: string, options?: ScannerScanOptions): Promise<ProjectModel>;
  /**
   * The language subsystem (universal Language Adapter System). Lazily
   * created with the built-in adapters; never contains engine logic.
   */
  readonly languages: LanguageManager;
  /**
   * The compiler subsystem (universal Compiler Layer). Lazily created with
   * the built-in compilers; the single gateway to native parsers/compilers.
   */
  readonly compiler: CompilerManager;
  /**
   * The symbol subsystem (universal Symbol Extraction Engine). Lazily
   * created with the built-in extractors; builds the normalized,
   * language-independent symbol model from compilation results.
   */
  readonly symbols: SymbolEngine;
  /**
   * The reference subsystem (universal Reference Resolution Engine). Lazily
   * created with the built-in resolvers; connects isolated symbols into a
   * resolved reference network.
   */
  readonly references: ReferenceEngine;
  /**
   * The graph subsystem (universal Knowledge Graph). Lazily created with the
   * built-in contributors; unifies the symbol hierarchy and the resolved
   * reference network into one derived, serializable graph.
   */
  readonly graph: GraphEngine;
  /** Releases materialised services. The engine can be re-initialized afterwards. */
  dispose(): Promise<void>;
}

class DocsEngineImpl implements DocsEngine {
  readonly services: ServiceContainer;

  private readonly options: EngineOptions;
  private initialized = false;
  private config: DocsConfig | undefined;
  private detection: ProjectDetection | undefined;
  private cacheService: CacheService;
  private languageManager: LanguageManager | undefined;
  private compilerManager: CompilerManager | undefined;
  private symbolEngine: SymbolEngine | undefined;
  private referenceEngine: ReferenceEngine | undefined;
  private graphEngine: GraphEngine | undefined;

  constructor(options: EngineOptions, container: ServiceContainer) {
    this.options = options;
    this.services = container;
    this.cacheService = container.resolve<CacheService>(CACHE_SERVICE);
  }

  get languages(): LanguageManager {
    if (this.languageManager === undefined) {
      this.languageManager = createLanguageManager();
    }
    return this.languageManager;
  }

  get compiler(): CompilerManager {
    if (this.compilerManager === undefined) {
      this.compilerManager = createCompilerManager({
        languages: this.languages,
      });
    }
    return this.compilerManager;
  }

  get symbols(): SymbolEngine {
    if (this.symbolEngine === undefined) {
      this.symbolEngine = createSymbolEngine({
        languages: this.languages,
        compilers: this.compiler,
      });
    }
    return this.symbolEngine;
  }

  get references(): ReferenceEngine {
    if (this.referenceEngine === undefined) {
      this.referenceEngine = createReferenceEngine({
        languages: this.languages,
      });
    }
    return this.referenceEngine;
  }

  get graph(): GraphEngine {
    if (this.graphEngine === undefined) {
      this.graphEngine = createGraphEngine();
    }
    return this.graphEngine;
  }

  private get logger(): Logger {
    return this.services.resolve<LoggerService>(LOGGER_SERVICE).logger;
  }

  private rootDir(override?: string): string {
    return override ?? this.options.rootDir ?? process.cwd();
  }

  async initialize(options?: { rootDir?: string; configPath?: string }): Promise<InitializeResult> {
    if (this.initialized) {
      return {
        config: this.config!,
        detection: this.detection!,
        cacheEnabled: this.cacheService.isEnabled,
      };
    }

    const logger = this.logger;
    const rootDir = this.rootDir(options?.rootDir);
    const configPath = options?.configPath ?? this.options.configPath;

    logger.info("Detecting project...");
    const projectService = this.services.resolve<ProjectService>(PROJECT_SERVICE);
    const detection = projectService.detect(rootDir);
    this.detection = detection;
    logger.info(`  Package manager: ${detection.packageManager}`);
    logger.info(`  Project type: ${detection.projectType}`);
    if (detection.workspaceInfo) {
      logger.info(`  Workspace: ${detection.workspaceInfo.name}`);
    }

    logger.info("Loading configuration...");
    const configService = this.services.resolve<ConfigService>(CONFIG_SERVICE);
    const { config } = await configService.load(rootDir, configPath);
    this.config = config;
    logger.info(`  Title: ${config.title}`);

    if (config.cache) {
      this.cacheService.enable(rootDir);
      this.cacheService.load();
    }

    this.initialized = true;

    return {
      config,
      detection,
      cacheEnabled: this.cacheService.isEnabled,
    };
  }

  async build(options?: BuildOptions): Promise<void> {
    const logger = options?.logger ?? this.logger;
    const rootDir = options?.rootDir ?? this.rootDir();

    await this.initialize({ rootDir, configPath: options?.configPath });

    const config = this.config!;

    logger.info("Discovering files...");
    const discovery = this.services.resolve<DiscoveryService>(DISCOVERY_SERVICE);
    const docFiles = await discovery.discoverDocFiles(rootDir, config.source, config.ignore);
    const sourceFiles = await discovery.discoverSourceFiles(
      rootDir,
      config.api.source,
      config.api.exclude,
    );
    logger.info(`  Doc files: ${docFiles.length}`);
    logger.info(`  Source files: ${sourceFiles.length}`);

    const cache = this.cacheService.isEnabled ? this.cacheService.store : undefined;
    const ctx = createBuildContext(config, rootDir, this.detection!, cache);
    (ctx as { sourceFiles: typeof ctx.sourceFiles }).sourceFiles = docFiles as never;

    if (config.clean) {
      ensureDir(resolveOutputDirectory(config));
    }

    const pluginService = this.services.resolve<PluginService>(PLUGIN_SERVICE);
    pluginService.setup(config);

    const pipeline = createPipeline({
      logger,
      plugins: pluginService.registry.getPlugins(),
    });

    await pipeline.run(ctx);

    // Phase 22.1: Materialize Documentation IR → md/next/static (non-destructive, manifest, ownership)
    try {
      const { materializeDocumentation } = await import("./docs-materialize.js");
      await materializeDocumentation(rootDir, config, logger);
    } catch (e) {
      logger.warn(`Materialization warning: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (this.cacheService.isEnabled) {
      this.cacheService.save();
    }
  }

  async runPipeline(ctx: BuildContextMutable): Promise<void> {
    const pluginService = this.services.resolve<PluginService>(PLUGIN_SERVICE);
    const pipeline = createPipeline({
      logger: this.logger,
      plugins: pluginService.registry.getPlugins(),
    });
    await pipeline.run(ctx);
  }

  async runGenerator(options: GenerateOptions): Promise<GenerationResult> {
    return generateDocs(options);
  }

  runAnalyzer(rootDir: string): ProjectAnalysis {
    return analyzeProject(rootDir);
  }

  async runScanner(rootDir: string, options?: ScannerScanOptions): Promise<ProjectModel> {
    const discovery = this.services.resolve<DiscoveryService>(DISCOVERY_SERVICE);
    return discovery.scanProject(rootDir, options);
  }

  async dispose(): Promise<void> {
    this.symbolEngine?.dispose();
    this.symbolEngine = undefined;
    this.referenceEngine?.dispose();
    this.referenceEngine = undefined;
    this.graphEngine?.dispose();
    this.graphEngine = undefined;
    if (this.languageManager !== undefined) {
      await this.languageManager.dispose();
      this.languageManager = undefined;
    }
    if (this.compilerManager !== undefined) {
      await this.compilerManager.dispose();
      this.compilerManager = undefined;
    }
    this.services.dispose();
    this.initialized = false;
    this.config = undefined;
    this.detection = undefined;
  }
}

/**
 * Creates a new {@link DocsEngine} instance.
 *
 * @param options - Optional engine options (root directory, config path, logger).
 * @returns A configured {@link DocsEngine}.
 *
 * @example
 * ```ts
 * const engine = createDocsEngine({ rootDir: "/project" });
 * await engine.initialize();
 * await engine.build();
 * await engine.dispose();
 * ```
 */
export function createDocsEngine(options: EngineOptions = {}): DocsEngine {
  const container = new ServiceContainer();
  if (options.logger) {
    container.registerValue(LOGGER_SERVICE, { logger: options.logger });
  } else {
    container.register(LOGGER_SERVICE, loggerServiceFactory);
  }
  container.register(PROJECT_SERVICE, projectServiceFactory);
  container.register(CONFIG_SERVICE, configServiceFactory);
  container.register(CACHE_SERVICE, cacheServiceFactory);
  container.register(PLUGIN_SERVICE, pluginServiceFactory);
  container.register(THEME_SERVICE, themeServiceFactory);
  container.register(DISCOVERY_SERVICE, discoveryServiceFactory);
  container.register(OUTPUT_SERVICE, outputServiceFactory);

  return new DocsEngineImpl(options, container);
}

/**
 * Runs a full documentation build using a fresh engine instance.
 *
 * @param options - The build options specifying root directory and logger.
 *
 * @example
 * ```ts
 * const log = createLogger();
 * await build({ rootDir: "/project", logger: log });
 * ```
 */
export async function build(options: BuildOptions): Promise<void> {
  const engine = createDocsEngine({ rootDir: options.rootDir, logger: options.logger });
  try {
    await engine.initialize();
    await engine.build(options);
  } finally {
    await engine.dispose();
  }
}
