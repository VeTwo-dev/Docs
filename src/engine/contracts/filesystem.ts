/**
 * Internal engine contract for filesystem access.
 *
 * Adapters wrap the `src/filesystem` module so the engine can operate
 * against an abstraction rather than concrete helpers.
 */
export interface FileSystemContract {
  readonly resolve: (rootDir: string, ...segments: string[]) => string;
  readonly ensureDir: (dirPath: string) => void;
  readonly writeFile: (filePath: string, content: string) => void;
  readonly readFile: (filePath: string) => string;
  readonly fileExists: (filePath: string) => boolean;
  readonly glob: (patterns: readonly string[], cwd: string) => Promise<readonly string[]>;
  readonly findFiles: (
    patterns: readonly string[],
    cwd: string,
    ignore?: readonly string[],
  ) => Promise<readonly string[]>;
}
