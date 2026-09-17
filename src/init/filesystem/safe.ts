import type { SafeFileSystem } from "./interface.js";

/** Outcome of a single safe operation. */
export interface SafeOpResult {
  readonly ok: boolean;
  readonly action: "created" | "preserved" | "merged" | "updated" | "skipped" | "error";
  readonly reason?: string;
}

/** Options shared by the safe operations. */
export interface SafeOpOptions {
  readonly fs: SafeFileSystem;
}

/**
 * Creates a file that must not already exist. Fails safely when the target
 * exists — callers must have classified the path first.
 */
export function safeCreate(file: string, content: string, options: SafeOpOptions): SafeOpResult {
  if (options.fs.exists(file)) {
    return { ok: false, action: "skipped", reason: "Target already exists" };
  }
  try {
    options.fs.writeFile(file, content);
    return { ok: true, action: "created" };
  } catch (error) {
    return {
      ok: false,
      action: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Options for {@link safeWrite}. */
export interface SafeWriteOptions extends SafeOpOptions {
  /** Expected current ownership. Pass `undefined` to allow blind writes. */
  readonly expectedOwnership?: string | undefined;
}

/**
 * Writes a file, distinguishing system-generated from user-owned content.
 * When `expectedOwnership` is provided and does not match, the write is
 * rejected — the caller should classify ownership via the safety layer.
 */
export function safeWrite(file: string, content: string, options: SafeWriteOptions): SafeOpResult {
  if (!options.fs.exists(file)) {
    return safeCreate(file, content, options);
  }
  if (
    options.expectedOwnership !== undefined &&
    options.expectedOwnership !== "system-managed" &&
    options.expectedOwnership !== "system-generated"
  ) {
    return {
      ok: false,
      action: "skipped",
      reason: `Refusing to overwrite ${options.expectedOwnership} content`,
    };
  }
  try {
    options.fs.writeFile(file, content);
    return { ok: true, action: "updated" };
  } catch (error) {
    return {
      ok: false,
      action: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Copies a file into place, never overwriting an existing target.
 */
export function safeCopy(from: string, to: string, options: SafeOpOptions): SafeOpResult {
  if (options.fs.exists(to)) {
    return { ok: false, action: "skipped", reason: "Target already exists" };
  }
  try {
    options.fs.copyFile(from, to);
    return { ok: true, action: "created" };
  } catch (error) {
    return {
      ok: false,
      action: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a directory recursively. Never removes or replaces an existing
 * directory.
 */
export function safeMkdir(dir: string, options: SafeOpOptions): SafeOpResult {
  if (options.fs.exists(dir)) {
    if (options.fs.isDirectory(dir)) {
      return { ok: false, action: "preserved", reason: "Directory already exists" };
    }
    return {
      ok: false,
      action: "skipped",
      reason: "Path exists and is not a directory",
    };
  }
  try {
    options.fs.mkdir(dir);
    return { ok: true, action: "created" };
  } catch (error) {
    return {
      ok: false,
      action: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes a file or empty directory. Refuses to remove non-empty directories
 * so user content is never destroyed by accident.
 */
export function safeRemove(path: string, options: SafeOpOptions): SafeOpResult {
  if (!options.fs.exists(path)) {
    return { ok: false, action: "skipped", reason: "Target does not exist" };
  }
  if (options.fs.isDirectory(path) && options.fs.listDir(path).length > 0) {
    return {
      ok: false,
      action: "skipped",
      reason: "Directory is not empty; refusing to remove",
    };
  }
  try {
    options.fs.remove(path);
    return { ok: true, action: "updated" };
  } catch (error) {
    return {
      ok: false,
      action: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export { safeCreate as safeCreateFile };
