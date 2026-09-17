import { ensureDir, writeFile } from "../../filesystem/index.js";
import { rimraf } from "rimraf";
import type { ServiceFactory } from "../container.js";

/**
 * Output service — owns writing generated output to disk.
 *
 * Wraps the filesystem helpers plus `rimraf` for cleaning output
 * directories.
 */
export interface OutputService {
  readonly ensureDir: (dirPath: string) => void;
  readonly writeFile: (filePath: string, content: string) => void;
  readonly clean: (dirPath: string) => Promise<void>;
}

export const OUTPUT_SERVICE = "output";

export const outputServiceFactory: ServiceFactory<OutputService> = () => ({
  ensureDir: (dirPath) => ensureDir(dirPath),
  writeFile: (filePath, content) => writeFile(filePath, content),
  clean: async (dirPath) => {
    await rimraf(dirPath);
  },
});
