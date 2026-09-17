import type { PackageManager, ProjectType } from "../../types/public.js";
import { DEFAULT_SCANNER_CACHE_FILE, ScannerCache } from "../cache/cache.js";
import { classifyAssetFile } from "../classifiers/asset-classifier.js";
import { classifyConfigFile, detectConfigTools } from "../classifiers/config-classifier.js";
import { classifyDirectory } from "../classifiers/directory-classifier.js";
import { classifyFile } from "../classifiers/file-classifier.js";
import { classifyProject, coarseProjectType } from "../classifiers/project-classifier.js";
import type { ClassifierSet } from "../classifiers/types.js";
import { buildClassifierSet } from "../classifiers/types.js";
import type {
  FileClassification,
  FileClassificationInput,
  ProjectClassificationInput,
  ScannerPlugin,
} from "../classifiers/types.js";
import {
  detectWorkspaceKind,
  expandWorkspacePatterns,
  type WorkspaceDetection,
} from "../discovery/workspace.js";
import { discoverPackages } from "../discovery/packages.js";
import {
  createDefaultRules,
  IgnoreEngine,
  loadIgnoreFilesForDir,
  type IgnoreRule,
} from "../filters/ignore.js";
import {
  createResourceFilter,
  shouldCollectKind,
  shouldIncludeResource,
  type ResourceFilter,
} from "../filters/resource.js";
import { createAssetModel, type AssetModel } from "../models/asset.js";
import { createConfigurationModel, type ConfigurationModel } from "../models/configuration.js";
import { createDiagnostic, type DiagnosticModel } from "../models/diagnostics.js";
import { createDirectoryModel, type DirectoryModel } from "../models/directory.js";
import { createFileModel, type FileModel } from "../models/file.js";
import type { PackageModel } from "../models/package.js";
import { createProjectModel, type ProjectModel, type ScanStats } from "../models/project.js";
import { createRelationship, type RelationshipModel } from "../models/relationships.js";
import { createWorkspaceModel, type WorkspaceModel } from "../models/workspace.js";
import { LocalFileSystemProvider } from "../providers/local.js";
import type { DirEntry, FileStats, ScannerProvider } from "../providers/types.js";
import type { ScanOptions, ScannerEngineOptions } from "../types/options.js";
import type { ProjectClassification, ScanSource } from "../types/categories.js";
import { hashContent } from "../utils/hash.js";
import {
  getBasename,
  getExtension,
  relativeDir,
  toPosixPath,
  toRelativePath,
} from "../utils/path.js";
import { ChokidarWatchSource, ScannerWatcher } from "../watch/watcher.js";

/** A previous-index entry used to skip re-hashing unchanged files. */
interface PreviousFileInfo {
  readonly hash?: string;
  readonly size: number;
  readonly mtime: number;
}

/** A stack frame used during directory traversal. */
interface StackNode {
  readonly rel: string;
  readonly abs: string;
  readonly depth: number;
  readonly rules: readonly IgnoreRule[];
  /** The symlink source path, when this frame was reached through a symlink. */
  readonly symlinkSource?: string;
}

/** The result of handling a symlink entry during traversal. */
interface SymlinkOutcome {
  readonly dirToPush?: StackNode;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
  readonly directBytes: number;
  readonly ignored: boolean;
}

/** The collections a scan accumulates. */
interface ScanSinks {
  readonly files: FileModel[];
  readonly configurations: ConfigurationModel[];
  readonly assets: AssetModel[];
  readonly collectFiles: boolean;
}

/** Options for {@link ScannerEngine.scan}. */
export interface ScannerScanOptions {
  /** A previous index to diff against (enables incremental heuristics). */
  readonly previous?: ProjectModel | null;
  /** Per-scan filter and collection options. */
  readonly options?: ScanOptions;
}

/** Options for {@link ScannerEngine.watch}. */
export interface ScannerWatchOptions {
  /** Extra ignore predicate (receives absolute paths). */
  readonly ignored?: (path: string) => boolean;
}

/** The scanner engine: produces unified {@link ProjectModel} indexes. */
export interface ScannerEngine {
  readonly provider: ScannerProvider;
  readonly rootDir: string;
  readonly cache: ScannerCache;
  /** The last index produced by {@link ScannerEngine.scan}, if any. */
  readonly lastIndex?: ProjectModel;
  scan(options?: ScannerScanOptions): Promise<ProjectModel>;
  watch(options?: ScannerWatchOptions): ScannerWatcher;
}

class ScannerEngineImpl implements ScannerEngine {
  readonly provider: ScannerProvider;
  readonly rootDir: string;
  readonly cache: ScannerCache;

  private readonly plugins: readonly ScannerPlugin[];
  private readonly classifiers: ClassifierSet;
  private readonly cacheEnabled: boolean;
  private readonly cacheFile: string;
  private _lastIndex: ProjectModel | undefined;

  constructor(options: ScannerEngineOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.provider = options.provider ?? new LocalFileSystemProvider(this.rootDir);
    this.plugins = [...(options.plugins ?? [])];
    this.classifiers = buildClassifierSet(
      {
        file: classifyFile,
        directory: classifyDirectory,
        project: classifyProject,
        config: classifyConfigFile,
        asset: classifyAssetFile,
      },
      this.plugins,
    );

    const cacheOption = options.cache;
    if (cacheOption === undefined || cacheOption === false) {
      this.cacheEnabled = false;
      this.cacheFile = DEFAULT_SCANNER_CACHE_FILE;
      this.cache = new ScannerCache();
    } else if (cacheOption === true) {
      this.cacheEnabled = true;
      this.cacheFile = DEFAULT_SCANNER_CACHE_FILE;
      this.cache = new ScannerCache();
    } else {
      this.cacheEnabled = cacheOption.enabled ?? cacheOption.path !== undefined;
      this.cacheFile = cacheOption.path ?? DEFAULT_SCANNER_CACHE_FILE;
      this.cache = new ScannerCache();
    }
  }

  get lastIndex(): ProjectModel | undefined {
    return this._lastIndex;
  }

  /** Loads the persisted scanner cache from the provider. */
  async loadCache(): Promise<void> {
    if (!this.cacheEnabled) return;
    await this.cache.load(this.provider, toPosixPath(`${this.rootDir}/${this.cacheFile}`));
  }

  /** Persists the scanner cache through the provider. */
  async saveCache(): Promise<void> {
    if (!this.cacheEnabled) return;
    await this.cache.save(this.provider, toPosixPath(`${this.rootDir}/${this.cacheFile}`));
  }

  async scan(scanOptions: ScannerScanOptions = {}): Promise<ProjectModel> {
    const start = performance.now();
    const scanOpts = scanOptions.options ?? {};
    const previous = scanOptions.previous ?? undefined;
    const collectMetadata = scanOpts.collectMetadata ?? false;

    for (const plugin of this.plugins) {
      if (plugin.onScanStart) await plugin.onScanStart();
    }

    const diagnostics: DiagnosticModel[] = [];

    // -- workspace & package discovery ------------------------------------
    const workspaceDetection = await detectWorkspaceKind(this.provider, this.rootDir);
    const workspaceDirs = await expandWorkspacePatterns(
      this.provider,
      this.rootDir,
      workspaceDetection.patterns,
    );
    const { packages, diagnostics: packageDiagnostics } = await discoverPackages(
      this.provider,
      this.rootDir,
      workspaceDirs,
      { strict: true },
    );
    diagnostics.push(...packageDiagnostics);

    // -- ignore context ----------------------------------------------------
    const disabledSources = scanOpts.disabledIgnoreSources ?? [];
    const baseRules: readonly IgnoreRule[] = [
      ...createDefaultRules().filter((rule) => !disabledSources.includes(rule.source)),
      ...this.plugins
        .flatMap((plugin) => plugin.ignoreRules ?? [])
        .filter((rule) => !disabledSources.includes(rule.source)),
    ];
    let ruleIndex = baseRules.length;

    const filter = createResourceFilter({
      include: scanOpts.include,
      exclude: scanOpts.exclude,
      maxDepth: scanOpts.maxDepth,
      resourceKinds: scanOpts.resourceKinds,
    });

    const collectConfig = shouldCollectKind("configuration", filter);
    const collectAssets = shouldCollectKind("asset", filter);
    const collectDirs = shouldCollectKind("directory", filter);

    const previousInfo = new Map<string, PreviousFileInfo>();
    if (previous) {
      for (const file of previous.files) {
        previousInfo.set(file.relativePath, {
          hash: file.hash,
          size: file.size,
          mtime: file.lastModified,
        });
      }
    }

    // -- traversal ----------------------------------------------------------
    const files: FileModel[] = [];
    const directories: DirectoryModel[] = [];
    const assets: AssetModel[] = [];
    const configurations: ConfigurationModel[] = [];
    const sinks: ScanSinks = {
      files,
      configurations,
      assets,
      collectFiles: shouldCollectKind("file", filter),
    };
    let ignoredCount = 0;
    let maxDepth = 0;

    const stack: StackNode[] = [
      { rel: ".", abs: toPosixPath(this.rootDir), depth: 0, rules: baseRules },
    ];

    while (stack.length > 0) {
      const node = stack.pop() as StackNode;
      maxDepth = Math.max(maxDepth, node.depth);

      const childRules: IgnoreRule[] = [...node.rules];
      const loaded = await loadIgnoreFilesForDir(this.provider, node.abs, node.rel, ruleIndex);
      if (loaded.length > 0) {
        childRules.push(...loaded);
        ruleIndex += loaded.length;
      }
      const ignore = new IgnoreEngine(childRules, { dot: scanOpts.dot });

      let childFiles = 0;
      let childDirs = 0;
      let directBytes = 0;
      const subDirs: StackNode[] = [];

      let entries: readonly DirEntry[];
      try {
        entries = await this.provider.listDir(node.abs);
      } catch {
        entries = [];
      }

      for (const entry of entries) {
        const rel = node.rel === "." ? entry.name : `${node.rel}/${entry.name}`;
        const abs = toPosixPath(entry.path);
        const entryDepth = node.depth + 1;

        if (entry.type === "symlink") {
          const outcome = await this.handleSymlink({
            abs,
            rel,
            depth: entryDepth,
            ignore,
            filter,
            collectMetadata,
            previousInfo,
            followSymlinks: scanOpts.followSymlinks === true,
            diagnostics,
            sinks,
          });
          if (outcome.dirToPush) subDirs.push(outcome.dirToPush);
          if (outcome.isDirectory) childDirs += 1;
          if (outcome.isFile) {
            childFiles += 1;
            directBytes += outcome.directBytes;
          }
          if (outcome.ignored) ignoredCount += 1;
          continue;
        }

        if (entry.type === "directory") {
          if (!shouldIncludeResource(rel, true, entryDepth, filter)) {
            ignoredCount += 1;
            continue;
          }
          if (ignore.isIgnored(rel) && !ignore.couldReincludeUnder(rel)) {
            ignoredCount += 1;
            continue;
          }
          subDirs.push({ rel, abs, depth: entryDepth, rules: childRules });
          childDirs += 1;
        } else if (entry.type === "file") {
          if (!shouldIncludeResource(rel, false, entryDepth, filter)) {
            ignoredCount += 1;
            continue;
          }
          if (ignore.isIgnored(rel)) {
            ignoredCount += 1;
            continue;
          }
          const stats = await this.provider.stat(abs);
          if (stats === undefined) continue;
          childFiles += 1;
          directBytes += stats.size;
          const model = await this.buildFileModel(abs, rel, stats, collectMetadata, previousInfo);
          if (sinks.collectFiles) sinks.files.push(model);
          this.collectExtensions(model, collectConfig, collectAssets, configurations, assets);
        }
      }

      if (collectDirs) {
        const isRoot = node.rel === ".";
        directories.push(
          createDirectoryModel({
            path: node.abs,
            relativePath: node.rel,
            name: isRoot ? "." : getBasename(node.abs),
            parent: isRoot ? "." : relativeDir(node.rel),
            depth: node.depth,
            category: classifyDirectory({
              name: isRoot ? "." : entryNameFromRel(node.rel),
              relativePath: node.rel,
              depth: node.depth,
            }),
            childDirectories: childDirs,
            childFiles,
            directBytes,
            ignored: false,
            metadata:
              node.symlinkSource !== undefined ? { symlink: true, source: node.symlinkSource } : {},
          }),
        );
      }

      for (const sub of subDirs) stack.push(sub);
    }

    // -- aggregates ----------------------------------------------------------
    const stats = computeStats(files, directories, maxDepth);
    const configTools = detectConfigTools(files);

    const rootPackage = packages.find((pkg) => pkg.isWorkspaceRoot);
    const classification = this.applyProjectClassifiers({
      name: rootPackage?.name ?? getBasename(this.rootDir),
      keywords: rootPackage?.keywords ?? [],
      dependencies: rootPackage?.dependencies ?? {},
      devDependencies: rootPackage?.devDependencies ?? {},
      peerDependencies: rootPackage?.peerDependencies ?? {},
      scripts: rootPackage?.scripts ?? {},
      hasWorkspaces: workspaceDetection.kind !== "none",
      packageCount: packages.length,
      packageManager: workspaceDetection.packageManager,
      configTools,
      isRootPackage: true,
    });
    const projectType = coarseProjectType(classification);

    const workspaces = buildWorkspaceModels(
      workspaceDetection,
      rootPackage,
      workspaceDirs,
      this.rootDir,
    );

    const relationships = buildRelationships(files, packages);

    if (collectMetadata) {
      collectDuplicateDiagnostics(files, diagnostics);
    }

    const duration = performance.now() - start;
    let index = createProjectModel({
      rootPath: toPosixPath(this.rootDir),
      name: rootPackage?.name ?? getBasename(this.rootDir),
      version: rootPackage?.version,
      packageManager: workspaceDetection.packageManager,
      projectType,
      classification,
      workspaces,
      packages,
      directories,
      files,
      assets,
      configurations,
      relationships,
      diagnostics,
      stats,
      ignoredCount,
      ignoreRuleCount: ruleIndex,
      scannedAt: Date.now(),
      scanDurationMs: duration,
      source: previous !== undefined ? "incremental" : "full",
      providerName: this.provider.name,
    });

    for (const plugin of this.plugins) {
      if (plugin.onScanComplete) index = await plugin.onScanComplete(index);
    }

    this._lastIndex = index;
    return index;
  }

  private collectExtensions(
    model: FileModel,
    collectConfig: boolean,
    collectAssets: boolean,
    configurations: ConfigurationModel[],
    assets: AssetModel[],
  ): void {
    if (collectConfig) {
      const detection = classifyConfigFile({
        name: model.name,
        relativePath: model.relativePath,
        extension: model.extension,
        dir: model.dir,
      });
      if (detection) {
        configurations.push(
          createConfigurationModel({ file: model, tool: detection.tool, format: detection.format }),
        );
      }
    }
    if (collectAssets) {
      const assetType = classifyAssetFile({
        name: model.name,
        relativePath: model.relativePath,
        extension: model.extension,
        dir: model.dir,
      });
      if (assetType !== null) {
        assets.push(createAssetModel({ file: model, type: assetType }));
      }
    }
  }

  private applyProjectClassifiers(
    input: ProjectClassificationInput,
  ): readonly ProjectClassification[] {
    for (const classifier of this.classifiers.project) {
      const result = classifier(input);
      if (result && result.length > 0) return result;
    }
    return ["unknown"];
  }

  private async handleSymlink(options: {
    readonly abs: string;
    readonly rel: string;
    readonly depth: number;
    readonly ignore: IgnoreEngine;
    readonly filter: ResourceFilter;
    readonly collectMetadata: boolean;
    readonly previousInfo: Map<string, PreviousFileInfo>;
    readonly followSymlinks: boolean;
    readonly diagnostics: DiagnosticModel[];
    readonly sinks: ScanSinks;
  }): Promise<SymlinkOutcome> {
    let target: string;
    try {
      target = await this.provider.realpath(options.abs);
    } catch {
      options.diagnostics.push(
        createDiagnostic({
          category: "broken-symlink",
          severity: "error",
          message: `Broken symlink at ${options.rel}`,
          path: options.abs,
          source: "scanner",
        }),
      );
      return { isDirectory: false, isFile: false, directBytes: 0, ignored: true };
    }

    const targetStats = await this.provider.stat(target);
    if (targetStats === undefined) {
      options.diagnostics.push(
        createDiagnostic({
          category: "broken-symlink",
          severity: "error",
          message: `Broken symlink at ${options.rel}`,
          path: options.abs,
          source: "scanner",
        }),
      );
      return { isDirectory: false, isFile: false, directBytes: 0, ignored: true };
    }

    if (targetStats.type === "directory") {
      if (!options.followSymlinks) {
        return { isDirectory: true, isFile: false, directBytes: 0, ignored: false };
      }
      if (
        options.ignore.isIgnored(options.rel) ||
        !shouldIncludeResource(options.rel, true, options.depth, options.filter)
      ) {
        return { isDirectory: true, isFile: false, directBytes: 0, ignored: true };
      }
      return {
        dirToPush: {
          rel: options.rel,
          abs: target,
          depth: options.depth,
          rules: options.ignore.all,
          symlinkSource: options.abs,
        },
        isDirectory: true,
        isFile: false,
        directBytes: 0,
        ignored: false,
      };
    }

    if (
      options.ignore.isIgnored(options.rel) ||
      !shouldIncludeResource(options.rel, false, options.depth, options.filter)
    ) {
      return { isDirectory: false, isFile: true, directBytes: targetStats.size, ignored: true };
    }
    const model = await this.buildFileModel(
      options.abs,
      options.rel,
      targetStats,
      options.collectMetadata,
      options.previousInfo,
    );
    if (options.sinks.collectFiles) options.sinks.files.push(model);
    this.collectExtensions(model, true, true, options.sinks.configurations, options.sinks.assets);
    return { isDirectory: false, isFile: true, directBytes: targetStats.size, ignored: false };
  }

  private async buildFileModel(
    abs: string,
    rel: string,
    stats: FileStats,
    collectMetadata: boolean,
    previousInfo: Map<string, PreviousFileInfo>,
  ): Promise<FileModel> {
    const name = getBasename(abs);
    const extension = getExtension(abs);
    const dir = relativeDir(rel);
    const input: FileClassificationInput = { name, relativePath: rel, extension, dir };

    let classification: FileClassification | null = null;
    for (const classifier of this.classifiers.file) {
      const result = classifier(input);
      if (result) {
        classification = result;
        break;
      }
    }
    const final = classification ?? { category: "unknown", language: "unknown", generated: false };

    let hash: string | undefined;
    if (collectMetadata) {
      hash = this.resolveHash(abs, rel, stats.size, stats.mtimeMs, previousInfo);
      if (hash === undefined) {
        try {
          hash = hashContent(await this.provider.readBytes(abs));
        } catch {
          hash = undefined;
        }
      }
      if (hash !== undefined && this.cacheEnabled) {
        this.cache.set(abs, { size: stats.size, mtimeMs: stats.mtimeMs, hash });
      }
    }

    let metadata: Record<string, unknown> = {};
    for (const collector of this.classifiers.metadata) {
      const extra = collector(input, final);
      if (extra) metadata = { ...metadata, ...extra };
    }

    return createFileModel({
      path: abs,
      relativePath: rel,
      name,
      extension,
      dir,
      size: stats.size,
      lastModified: stats.mtimeMs,
      createdAt: stats.ctimeMs,
      ...(hash !== undefined ? { hash } : {}),
      language: final.language,
      category: final.category,
      generated: final.generated,
      symlink: false,
      metadata,
    });
  }

  private resolveHash(
    abs: string,
    rel: string,
    size: number,
    mtimeMs: number,
    previousInfo: Map<string, PreviousFileInfo>,
  ): string | undefined {
    if (this.cacheEnabled && this.cache.isValid(abs, size, mtimeMs)) {
      return this.cache.get(abs)?.hash;
    }
    const prev = previousInfo.get(rel);
    if (
      prev !== undefined &&
      prev.size === size &&
      prev.mtime === mtimeMs &&
      prev.hash !== undefined
    ) {
      return prev.hash;
    }
    return undefined;
  }

  watch(options: ScannerWatchOptions = {}): ScannerWatcher {
    const root = toPosixPath(this.rootDir);
    const ignoreEngine = new IgnoreEngine(createDefaultRules());
    const source = new ChokidarWatchSource({
      rootDir: root,
      ignored: (path: string) => {
        if (options.ignored?.(path)) return true;
        const rel = toRelativePath(root, path);
        return ignoreEngine.isIgnored(rel);
      },
    });
    return new ScannerWatcher({
      source,
      rootDir: root,
      packages: this._lastIndex?.packages,
      workspaces: this._lastIndex?.workspaces,
    });
  }
}

function entryNameFromRel(rel: string): string {
  const idx = rel.lastIndexOf("/");
  return idx === -1 ? rel : rel.slice(idx + 1);
}

/** Computes aggregate scan statistics. */
function computeStats(
  files: readonly FileModel[],
  directories: readonly DirectoryModel[],
  maxDepth: number,
): ScanStats {
  const filesByCategory: Record<string, number> = {};
  const filesByExtension: Record<string, number> = {};
  const filesByLanguage: Record<string, number> = {};
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    filesByCategory[file.category] = (filesByCategory[file.category] ?? 0) + 1;
    const extension = file.extension || "(none)";
    filesByExtension[extension] = (filesByExtension[extension] ?? 0) + 1;
    filesByLanguage[file.language] = (filesByLanguage[file.language] ?? 0) + 1;
  }
  return {
    totalFiles: files.length,
    totalDirectories: directories.length,
    totalBytes,
    filesByCategory,
    filesByExtension,
    filesByLanguage,
    maxDepth,
  };
}

/** Builds package-containment relationships for every file. */
function buildRelationships(
  files: readonly FileModel[],
  packages: readonly PackageModel[],
): readonly RelationshipModel[] {
  const sorted = [...packages].sort((a, b) => b.relativePath.length - a.relativePath.length);
  const relationships: RelationshipModel[] = [];
  for (const file of files) {
    const owner = sorted.find((pkg) => {
      if (pkg.relativePath === ".") return true;
      return file.relativePath.startsWith(`${pkg.relativePath}/`);
    });
    if (owner) {
      relationships.push(
        createRelationship({
          type: "package",
          from: file.relativePath,
          to: owner.relativePath,
          kind: "contains",
        }),
      );
    }
  }
  return relationships;
}

/** Builds the workspace models from a workspace detection. */
function buildWorkspaceModels(
  detection: WorkspaceDetection,
  rootPackage: PackageModel | undefined,
  workspaceDirs: readonly string[],
  rootDir: string,
): readonly WorkspaceModel[] {
  if (detection.kind === "none") return [];
  return [
    createWorkspaceModel({
      kind: detection.kind,
      name: rootPackage?.name ?? detection.kind,
      path: toPosixPath(rootPackage?.path ?? rootDir),
      relativePath: ".",
      root: true,
      packageCount: detection.patterns.length > 0 ? workspaceDirs.length + 1 : 1,
      packages: workspaceDirs,
      patterns: detection.patterns,
      configPath: detection.configPath,
      packageManager: detection.packageManager,
      metadata: detection.metadata,
    }),
  ];
}

/** Emits duplicate-content diagnostics when metadata collection is enabled. */
function collectDuplicateDiagnostics(
  files: readonly FileModel[],
  diagnostics: DiagnosticModel[],
): void {
  const byHash = new Map<string, FileModel[]>();
  for (const file of files) {
    if (!file.hash) continue;
    const bucket = byHash.get(file.hash) ?? [];
    bucket.push(file);
    byHash.set(file.hash, bucket);
  }
  for (const bucket of byHash.values()) {
    if (bucket.length > 1) {
      diagnostics.push(
        createDiagnostic({
          category: "duplicate",
          severity: "info",
          message: `Duplicate content across ${bucket.length} files`,
          path: bucket[0]?.relativePath,
          related: bucket.slice(1).map((file) => file.relativePath),
          source: "scanner",
        }),
      );
    }
  }
}

/**
 * Creates a scanner engine.
 *
 * @param options - Engine options.
 * @returns A configured scanner engine.
 *
 * @example
 * ```ts
 * const engine = createScannerEngine({ cache: true });
 * const index = await engine.scan({ options: { collectMetadata: true } });
 * ```
 */
export function createScannerEngine(options: ScannerEngineOptions = {}): ScannerEngine {
  return new ScannerEngineImpl(options);
}

/** Convenience: run a full scan with defaults and return the index. */
export async function scanProject(
  rootDir: string,
  options: ScannerEngineOptions & ScanOptions = {},
): Promise<ProjectModel> {
  const engine = new ScannerEngineImpl({ rootDir, ...options });
  return engine.scan({ options });
}

export type { PackageManager };
export type { ProjectType };
export type { ScanSource };
