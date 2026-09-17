/**
 * Watch-event vocabulary for the scanner subsystem.
 *
 * Raw filesystem events are normalised into high-level scanner events so
 * consumers can react to changes without depending on chokidar or provider
 * internals.
 */

/** A file- or directory-level filesystem change. */
export type ScannerEventType =
  "file-added" | "file-modified" | "file-removed" | "directory-added" | "directory-removed";

/** A high-level change to project structure (packages, workspaces, configs). */
export type ScannerStructureEventType =
  | "package-added"
  | "package-removed"
  | "package-modified"
  | "workspace-changed"
  | "configuration-changed";

export type AllScannerEventType = ScannerEventType | ScannerStructureEventType;

/** Base fields shared by every scanner watch event. */
export interface ScannerEventBase {
  /** The absolute path that changed. */
  readonly path: string;
  /** The path relative to the watched root, in POSIX form. */
  readonly relativePath: string;
  /** The time the event was produced. */
  readonly timestamp: number;
}

/** A raw filesystem event emitted by a watch source. */
export type RawWatchEventType = "add" | "change" | "unlink" | "addDir" | "unlinkDir";

/** A raw filesystem event, provider-agnostic. */
export interface RawWatchEvent {
  readonly type: RawWatchEventType;
  /** Absolute path of the changed resource. */
  readonly path: string;
}

/** A normalised file-level scanner event. */
export interface ScannerFileEvent extends ScannerEventBase {
  readonly type: ScannerEventType;
}

/** A high-level structural scanner event. */
export interface ScannerStructureEvent extends ScannerEventBase {
  readonly type: ScannerStructureEventType;
  /** The name of the affected package/workspace/tool, when known. */
  readonly subject?: string;
}

/** Any event emitted by the scanner watcher. */
export type ScannerWatchEvent = ScannerFileEvent | ScannerStructureEvent;

/** A listener for scanner watch events. */
export type ScannerWatchListener = (event: ScannerWatchEvent) => void;
