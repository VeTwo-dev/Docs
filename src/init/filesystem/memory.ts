import type { SafeFileSystem } from "./interface.js";
import { posixJoin, posixRelative, posixResolve } from "./interface.js";

interface MemoryEntry {
  readonly content: string;
}

/**
 * In-memory filesystem implementation for tests and embedded usage.
 *
 * Directories are implicit: any path that is a prefix of a stored file (or
 * was explicitly created) is treated as a directory. Paths are normalised to
 * POSIX form so behaviour is identical across operating systems.
 */
export class MemorySafeFileSystem implements SafeFileSystem {
  private readonly files = new Map<string, MemoryEntry>();
  private readonly dirs = new Set<string>();
  /** Patterns (regex source) whose matching file writes should throw. */
  private failPatterns: readonly string[] = [];
  private readonly listeners: Array<(path: string, kind: "file" | "directory" | "remove") => void> =
    [];

  resolve(base: string, ...parts: readonly string[]): string {
    return posixResolve(base, ...parts);
  }

  relative(from: string, to: string): string {
    return posixRelative(from, to);
  }

  join(...parts: readonly string[]): string {
    return posixJoin(...parts);
  }

  /** Configure paths whose writes should fail (simulates I/O errors). */
  failOn(pattern: string | readonly string[]): void {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    this.failPatterns = [...this.failPatterns, ...patterns];
  }

  /** Clear all injected failures. */
  clearFailures(): void {
    this.failPatterns = [];
  }

  onWrite(listener: (path: string, kind: "file" | "directory" | "remove") => void): void {
    this.listeners.push(listener);
  }

  exists(path: string): boolean {
    const p = posixResolve(path);
    if (this.files.has(p) || this.dirs.has(p)) return true;
    return this.isDirectory(p);
  }

  isFile(path: string): boolean {
    return this.files.has(posixResolve(path));
  }

  isDirectory(path: string): boolean {
    const p = posixResolve(path);
    if (this.files.has(p)) return false;
    if (this.dirs.has(p)) return true;
    for (const file of this.files.keys()) {
      if (file.startsWith(p + "/")) return true;
    }
    return false;
  }

  mkdir(dir: string): void {
    const p = posixResolve(dir);
    this.dirs.add(p);
    const parts = p.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
      this.dirs.add(parts.slice(0, i).join("/"));
    }
  }

  writeFile(file: string, content: string): void {
    const p = posixResolve(file);
    for (const pattern of this.failPatterns) {
      if (new RegExp(pattern).test(p)) {
        throw new Error(`Simulated write failure: ${p}`);
      }
    }
    this.files.set(p, { content });
    this.mkdir(dirname(p));
    for (const listener of this.listeners) listener(p, "file");
  }

  readFile(file: string): string {
    const p = posixResolve(file);
    const entry = this.files.get(p);
    if (entry === undefined) {
      throw new Error(`File not found: ${p}`);
    }
    return entry.content;
  }

  copyFile(from: string, to: string): void {
    this.writeFile(to, this.readFile(from));
  }

  rename(from: string, to: string): void {
    const source = posixResolve(from);
    const dest = posixResolve(to);
    if (this.isFile(source)) {
      const content = this.readFile(source);
      this.remove(source);
      this.writeFile(dest, content);
      return;
    }
    if (this.isDirectory(source)) {
      for (const file of this.files.keys()) {
        if (file.startsWith(source + "/")) {
          const content = this.readFile(file);
          this.files.delete(file);
          this.files.set(dest + file.slice(source.length), { content });
        }
      }
      this.remove(source);
      return;
    }
    throw new Error(`File not found: ${source}`);
  }

  remove(path: string): boolean {
    const p = posixResolve(path);
    let removed = false;
    if (this.files.has(p)) {
      this.files.delete(p);
      removed = true;
    } else if (this.isDirectory(p)) {
      for (const file of [...this.files.keys()]) {
        if (file.startsWith(p + "/")) {
          this.files.delete(file);
          removed = true;
        }
      }
      for (const dir of [...this.dirs]) {
        if (dir === p || dir.startsWith(p + "/")) {
          this.dirs.delete(dir);
          removed = true;
        }
      }
    }
    if (removed) {
      for (const listener of this.listeners) listener(p, "remove");
    }
    return removed;
  }

  listDir(dir: string): readonly string[] {
    const p = posixResolve(dir);
    const names = new Set<string>();
    for (const file of this.files.keys()) {
      if (file.startsWith(p + "/")) {
        const rest = file.slice(p.length + 1);
        const first = rest.split("/")[0];
        if (first) names.add(first);
      }
    }
    for (const d of this.dirs) {
      if (d.startsWith(p + "/")) {
        const rest = d.slice(p.length + 1);
        const first = rest.split("/")[0];
        if (first) names.add(first);
      }
    }
    return [...names].sort();
  }

  listFiles(root: string): readonly string[] {
    const p = posixResolve(root);
    const out: string[] = [];
    for (const file of this.files.keys()) {
      if (file.startsWith(p + "/")) {
        out.push(posixRelative(p, file));
      }
    }
    return out.sort();
  }

  /** All files stored, keyed by normalised path (test helper). */
  snapshot(): ReadonlyMap<string, string> {
    return new Map([...this.files.entries()].map(([k, v]) => [k, v.content]));
  }
}

function dirname(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx <= 0 ? "/" : p.slice(0, idx);
}
