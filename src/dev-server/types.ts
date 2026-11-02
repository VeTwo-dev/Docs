import { resolve } from "node:path";

/** Configuration for the development server. */
export interface DevServerConfig {
  /** Port to listen on (default: 3000). */
  readonly port: number;
  /** Host to bind to (default: "localhost"). */
  readonly host: string;
  /** Whether to open the browser automatically (default: false). */
  readonly open: boolean;
  /** The source directory to watch for markdown changes. */
  readonly sourceDir: string;
  /** Additional directories to watch for changes. */
  readonly extraWatch: readonly string[];
  /**
   * Directory to serve (defaults to `<rootDir>/docs`). Callers that resolve
   * a configured output directory should pass it explicitly so `dev` serves
   * exactly what `build` produces.
   */
  readonly outputDir?: string;
}

/** Default dev server configuration. */
export const DEFAULT_DEV_SERVER_CONFIG: DevServerConfig = {
  port: 3000,
  host: "localhost",
  open: false,
  sourceDir: "src",
  extraWatch: [],
};

/**
 * Resolve the directory the dev server serves. An explicit
 * `config.outputDir` wins; otherwise the historical `<rootDir>/docs`
 * default applies (backward compatible). Pure and unit-testable; the
 * server itself just consumes the result.
 */
export function resolveDevOutputDir(
  rootDir: string,
  config: Pick<DevServerConfig, "outputDir">,
): string {
  const outputDir = config.outputDir ?? "docs";
  return resolve(rootDir, outputDir);
}
