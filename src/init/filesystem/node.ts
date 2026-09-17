import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";
import type { SafeFileSystem } from "./interface.js";
import { posixJoin, posixRelative, posixResolve } from "./interface.js";

/**
 * The production filesystem implementation backed by `node:fs`.
 */
export class NodeSafeFileSystem implements SafeFileSystem {
  resolve(base: string, ...parts: readonly string[]): string {
    return posixResolve(base, ...parts);
  }

  relative(from: string, to: string): string {
    return posixRelative(from, to);
  }

  join(...parts: readonly string[]): string {
    return posixJoin(...parts);
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  isFile(path: string): boolean {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  }

  isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  mkdir(dir: string): void {
    mkdirSync(dir, { recursive: true });
  }

  writeFile(file: string, content: string): void {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, "utf-8");
  }

  readFile(file: string): string {
    return readFileSync(file, "utf-8");
  }

  copyFile(from: string, to: string): void {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }

  rename(from: string, to: string): void {
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
  }

  remove(path: string): boolean {
    if (!existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    return true;
  }

  listDir(dir: string): readonly string[] {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  }

  listFiles(root: string): readonly string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = posixJoin(dir, name);
        let isDir: boolean;
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (isDir) {
          walk(full);
        } else {
          out.push(posixRelative(root, full));
        }
      }
    };
    if (!existsSync(root)) return [];
    walk(root);
    return out.sort();
  }
}
