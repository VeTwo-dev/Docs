import type { Visibility } from "./categories.js";

/** The provider backing a scan. */
export type ScannerProviderName = "local" | "memory" | "vfs" | "zip" | "git" | string;

/** Metadata describing a scanned file. */
export interface FileMetadata {
  /** The detected programming/markup language, or `"unknown"`. */
  readonly language: string;
  /** The detected file category. */
  readonly category: string;
  /** Whether the file is generated (source maps, minified output, etc.). */
  readonly generated: boolean;
  /** Best-effort text encoding (`"utf8"` for text files, `"binary"` otherwise). */
  readonly encoding: "utf8" | "binary";
  /** The file visibility with respect to ignore rules. */
  readonly visibility: Visibility;
  /** Extra provider-specific or plugin-provided metadata. */
  readonly [key: string]: unknown;
}
