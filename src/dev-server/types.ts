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
}

/** Default dev server configuration. */
export const DEFAULT_DEV_SERVER_CONFIG: DevServerConfig = {
  port: 3000,
  host: "localhost",
  open: false,
  sourceDir: "src",
  extraWatch: [],
};
