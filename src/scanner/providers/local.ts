import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import fg from "fast-glob";
import { toPosixPath } from "../utils/path.js";
import type { DirEntry, FileStats, GlobOptions, ScannerProvider } from "./types.js";

/**
 * A {@link ScannerProvider} backed by the real filesystem.
 *
 * This is the only scanner module allowed to touch `node:fs` directly — every
 * other scanner module talks to resources through this boundary (or a memory
 * provider).
 */
export class LocalFileSystemProvider implements ScannerProvider {
  readonly name = "local";

  private readonly root: string;

  constructor(rootDir?: string) {
    this.root = rootDir ?? process.cwd();
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      return (await fs.stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      return (await fs.stat(path)).isFile();
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileStats | undefined> {
    try {
      const stats = await fs.lstat(path);
      return {
        type: stats.isDirectory()
          ? "directory"
          : stats.isFile()
            ? "file"
            : stats.isSymbolicLink()
              ? "symlink"
              : "unknown",
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs,
        mode: stats.mode,
      };
    } catch {
      return undefined;
    }
  }

  async listDir(path: string): Promise<readonly DirEntry[]> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      const result: DirEntry[] = [];
      for (const entry of entries) {
        const fullPath = resolve(path, entry.name);
        const type = entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : entry.isSymbolicLink()
              ? "symlink"
              : "unknown";

        // Security: for symlinks, resolve and verify they stay within project root
        if (entry.isSymbolicLink()) {
          try {
            const resolved = await fs.realpath(fullPath);
            const normalizedRoot = resolve(this.root);
            if (!resolved.startsWith(normalizedRoot)) {
              continue; // Skip symlinks that escape the project root
            }
          } catch {
            continue; // Skip broken symlinks
          }
        }

        result.push({ name: entry.name, path: fullPath, type });
      }
      return result;
    } catch {
      return [];
    }
  }

  async readFile(path: string): Promise<string> {
    return fs.readFile(path, "utf-8");
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return fs.readFile(path);
  }

  async glob(patterns: readonly string[], options: GlobOptions = {}): Promise<readonly string[]> {
    const cwd = options.cwd ?? this.root;
    const results = (await fg([...patterns], {
      cwd,
      onlyFiles: !options.onlyDirectories,
      dot: true,
      markDirectories: options.onlyDirectories === true,
      absolute: true,
      unique: true,
    })) as string[];
    const matches = options.onlyDirectories
      ? results.filter((result) => result.endsWith("/"))
      : results;
    return matches.map((match) => toPosixPath(match));
  }

  async realpath(path: string): Promise<string> {
    return toPosixPath(await fs.realpath(path));
  }

  async readLink(path: string): Promise<string | undefined> {
    try {
      return await fs.readlink(path);
    } catch {
      return undefined;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, "utf-8");
  }

  async ensureDir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }
}
