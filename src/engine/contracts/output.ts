/**
 * Internal engine contract for writing build output.
 */
export interface OutputWriterContract {
  readonly ensureDir: (dirPath: string) => void;
  readonly writeFile: (filePath: string, content: string) => void;
  readonly clean: (dirPath: string) => Promise<void>;
}
