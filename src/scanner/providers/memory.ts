import { relative, resolve } from "node:path";
import { matchPath } from "../utils/glob.js";
import { toPosixPath } from "../utils/path.js";
import type { DirEntry, FileStats, GlobOptions, ScannerProvider } from "./types.js";

/** Options for constructing a {@link MemoryProvider}. */
export interface MemoryFileOptions {
  /** Path → UTF-8 content map. Paths may be absolute or relative to the root. */
  readonly files?: Readonly<Record<string, string>>;
  /** Path → binary content map. */
  readonly binaryFiles?: Readonly<Record<string, Uint8Array>>;
  /** Symlinks to create. */
  readonly symlinks?: readonly { readonly path: string; readonly target: string }[];
  /** Mtime (epoch ms) reported for every file. Defaults to `0`. */
  readonly mtimeMs?: number;
}

const decoder = new TextDecoder();

/**
 * An in-memory {@link ScannerProvider} used for tests and virtual trees.
 *
 * Directories are implicit — any path prefix of a stored file is a directory.
 */
export class MemoryProvider implements ScannerProvider {
  readonly name = "memory";

  private readonly root: string;
  private readonly files = new Map<string, Uint8Array>();
  private readonly symlinks = new Map<string, string>();
  private readonly defaultMtimeMs: number;

  constructor(rootDir: string, options: MemoryFileOptions = {}) {
    this.root = toPosixPath(resolve(rootDir));
    this.defaultMtimeMs = options.mtimeMs ?? 0;
    for (const [path, content] of Object.entries(options.files ?? {})) {
      this.files.set(this.resolve(path), Buffer.from(content, "utf-8"));
    }
    for (const [path, content] of Object.entries(options.binaryFiles ?? {})) {
      this.files.set(this.resolve(path), content);
    }
    for (const link of options.symlinks ?? []) {
      this.symlinks.set(this.resolve(link.path), link.target);
    }
  }

  private resolve(path: string): string {
    return toPosixPath(resolve(this.root, path));
  }

  private isDirectoryPath(path: string): boolean {
    if (path === this.root) return true;
    const prefix = `${path}/`;
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) return true;
    }
    for (const link of this.symlinks.keys()) {
      if (link.startsWith(prefix)) return true;
    }
    return false;
  }

  async exists(path: string): Promise<boolean> {
    const resolved = this.resolve(path);
    return (
      this.files.has(resolved) || this.symlinks.has(resolved) || this.isDirectoryPath(resolved)
    );
  }

  async isDirectory(path: string): Promise<boolean> {
    return this.isDirectoryPath(this.resolve(path));
  }

  async isFile(path: string): Promise<boolean> {
    return this.files.has(this.resolve(path));
  }

  async stat(path: string): Promise<FileStats | undefined> {
    const resolved = this.resolve(path);
    if (this.symlinks.has(resolved)) {
      return {
        type: "symlink",
        size: 0,
        mtimeMs: this.defaultMtimeMs,
        ctimeMs: this.defaultMtimeMs,
        mode: 0o120777,
      };
    }
    const bytes = this.files.get(resolved);
    if (bytes !== undefined) {
      return {
        type: "file",
        size: bytes.byteLength,
        mtimeMs: this.defaultMtimeMs,
        ctimeMs: this.defaultMtimeMs,
        mode: 0o100644,
      };
    }
    if (this.isDirectoryPath(resolved)) {
      return {
        type: "directory",
        size: 0,
        mtimeMs: this.defaultMtimeMs,
        ctimeMs: this.defaultMtimeMs,
        mode: 0o40755,
      };
    }
    return undefined;
  }

  async listDir(path: string): Promise<readonly DirEntry[]> {
    const resolved = this.resolve(path);
    if (!this.isDirectoryPath(resolved)) return [];
    const children = new Set<string>();
    const prefix = resolved === this.root ? `${this.root}/` : `${resolved}/`;
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const rest = file.slice(prefix.length);
        const name = rest.split("/", 1)[0];
        if (name !== undefined && name !== "") children.add(name);
      }
    }
    for (const link of this.symlinks.keys()) {
      if (link.startsWith(prefix)) {
        const rest = link.slice(prefix.length);
        const name = rest.split("/", 1)[0];
        if (name !== undefined && name !== "") children.add(name);
      }
    }
    const entries: DirEntry[] = [];
    for (const name of children) {
      const childPath = toPosixPath(resolve(resolved, name));
      const type = this.symlinks.has(childPath)
        ? "symlink"
        : this.files.has(childPath)
          ? "file"
          : "directory";
      entries.push({ name, path: childPath, type });
    }
    return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  async readFile(path: string): Promise<string> {
    const bytes = this.files.get(this.resolve(path));
    if (bytes === undefined) throw new Error(`ENOENT: ${path}`);
    return decoder.decode(bytes);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(this.resolve(path));
    if (bytes === undefined) throw new Error(`ENOENT: ${path}`);
    return bytes;
  }

  async glob(patterns: readonly string[], options: GlobOptions = {}): Promise<readonly string[]> {
    const cwd = options.cwd !== undefined ? this.resolve(options.cwd) : this.root;
    const candidates: string[] = [];
    if (options.onlyDirectories) {
      const dirs = new Set<string>();
      for (const file of [...this.files.keys(), ...this.symlinks.keys()]) {
        if (!file.startsWith(`${cwd}/`)) continue;
        const rest = file.slice(cwd.length + 1);
        const parts = rest.split("/");
        for (let i = 1; i < parts.length; i += 1) {
          dirs.add(toPosixPath(resolve(cwd, ...parts.slice(0, i))));
        }
      }
      candidates.push(...dirs);
    } else {
      for (const file of this.files.keys()) {
        if (file.startsWith(`${cwd}/`)) candidates.push(file);
      }
      for (const link of this.symlinks.keys()) {
        if (link.startsWith(`${cwd}/`)) candidates.push(link);
      }
    }
    const matches: string[] = [];
    for (const candidate of candidates) {
      const rel = toPosixPath(relative(cwd, candidate));
      if (patterns.some((pattern) => matchPath(pattern, rel, { dot: true }))) {
        matches.push(candidate);
      }
    }
    return matches.sort();
  }

  async realpath(path: string): Promise<string> {
    const resolved = this.resolve(path);
    const target = this.symlinks.get(resolved);
    if (target !== undefined) {
      const resolvedTarget = toPosixPath(resolve(this.root, target));
      if (!this.files.has(resolvedTarget) && !this.isDirectoryPath(resolvedTarget)) {
        throw new Error(`ENOENT: ${target}`);
      }
      return resolvedTarget;
    }
    if (this.files.has(resolved) || this.isDirectoryPath(resolved)) {
      return resolved;
    }
    throw new Error(`ENOENT: ${path}`);
  }

  async readLink(path: string): Promise<string | undefined> {
    return this.symlinks.get(this.resolve(path));
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(this.resolve(path), Buffer.from(content, "utf-8"));
  }

  async ensureDir(_path: string): Promise<void> {
    // directories are implicit in the memory provider
  }
}
