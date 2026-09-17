import type { PackageInfo, SourceFile, ProjectType, PackageManager } from "../../types/public.js";

/** Configuration for the automatic documentation generator. */
export interface GeneratorConfig {
  readonly enabled: boolean;
  readonly mode: "manual" | "auto" | "hybrid";
  readonly output: string;
  readonly overwrite: boolean;
  readonly api: boolean;
  readonly architecture: boolean;
  readonly guides: boolean;
  readonly configuration: boolean;
  readonly cli: boolean;
  readonly faq: boolean;
  readonly troubleshooting: boolean;
  readonly examples: boolean;
  readonly recipes: boolean;
  readonly changelog: boolean;
  readonly search: boolean;
  readonly sidebar: boolean;
  readonly navigation: boolean;
}

/** Partial input for generator config. */
export type GeneratorConfigInput = Partial<GeneratorConfig>;

/** Result of analyzing a project's source code. */
export interface ProjectAnalysis {
  readonly rootDir: string;
  readonly packageInfo: PackageInfo | undefined;
  readonly projectType: ProjectType;
  readonly packageManager: PackageManager;
  readonly sourceFiles: readonly SourceFile[];
  readonly configFiles: readonly ConfigFile[];
  readonly directoryTree: DirectoryNode;
  readonly publicExports: readonly PublicExport[];
  readonly scripts: Record<string, string>;
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
  readonly hasReadme: boolean;
  readonly hasLicense: boolean;
  readonly hasDocker: boolean;
  readonly hasCI: boolean;
  readonly hasTests: boolean;
  readonly hasTypeScript: boolean;
  readonly framework: FrameworkDetection;
}

/** A configuration file found in the project. */
export interface ConfigFile {
  readonly name: string;
  readonly path: string;
  readonly kind: ConfigFileKind;
}

/** Kind of configuration file. */
export type ConfigFileKind =
  | "package-manager"
  | "typescript"
  | "bundler"
  | "framework"
  | "linter"
  | "formatter"
  | "ci"
  | "docker"
  | "workspace"
  | "env"
  | "other";

/** A node in the project directory tree. */
export interface DirectoryNode {
  readonly name: string;
  readonly path: string;
  readonly type: "file" | "directory";
  readonly children: readonly DirectoryNode[];
  readonly size?: number;
}

/** A publicly exported symbol from the source code. */
export interface PublicExport {
  readonly name: string;
  readonly kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "const";
  readonly sourceFile: string;
  readonly description: string;
  readonly signature: string;
  readonly parameters: readonly ExportParameter[];
  readonly returnType: string;
  readonly deprecated: boolean;
  readonly since: string | undefined;
  readonly examples: readonly string[];
  readonly tags: readonly string[];
}

/** A parameter of a public export. */
export interface ExportParameter {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly defaultValue: string | undefined;
}

/** Detected framework in the project. */
export interface FrameworkDetection {
  readonly name: string | undefined;
  readonly version: string | undefined;
  readonly kind:
    | "react"
    | "vue"
    | "svelte"
    | "angular"
    | "next"
    | "nuxt"
    | "astro"
    | "express"
    | "fastify"
    | "hono"
    | "nest"
    | "vite"
    | "other"
    | undefined;
}

/** A generated documentation page. */
export interface GeneratedPage {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly order: number;
  readonly content: string;
  readonly source: string;
  readonly related: readonly string[];
  readonly readingTimeMinutes: number;
}

/** A generated metadata file. */
export interface GeneratedMetadata {
  readonly filename: string;
  readonly content: string;
  readonly kind: "json" | "yaml";
}

/** Result of the full generation process. */
export interface GenerationResult {
  readonly pages: readonly GeneratedPage[];
  readonly metadata: readonly GeneratedMetadata[];
  readonly stats: GenerationStats;
}

/** Statistics about the generation process. */
export interface GenerationStats {
  readonly totalPages: number;
  readonly totalMetadata: number;
  readonly filesScanned: number;
  readonly exportsFound: number;
  readonly duration: number;
  readonly incremental: boolean;
  readonly cacheHits: number;
  readonly cacheMisses: number;
}

/** Context passed to individual generators. */
export interface GeneratorContext {
  readonly analysis: ProjectAnalysis;
  readonly config: GeneratorConfig;
  readonly rootDir: string;
  readonly outputDir: string;
}
