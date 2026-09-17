import type { AssetType } from "../types/categories.js";
import type { FileClassificationInput } from "./types.js";

/** Asset type assigned to each extension. */
export const ASSET_TYPE_BY_EXTENSION: Readonly<Record<string, AssetType>> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".avif": "image",
  ".bmp": "image",
  ".tiff": "image",
  ".woff": "font",
  ".woff2": "font",
  ".ttf": "font",
  ".otf": "font",
  ".eot": "font",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".mkv": "video",
  ".avi": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".flac": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".ico": "icon",
  ".icns": "icon",
  ".cur": "icon",
  ".svg": "svg",
  ".pdf": "document",
  ".doc": "document",
  ".docx": "document",
  ".xls": "document",
  ".xlsx": "document",
  ".ppt": "document",
  ".pptx": "document",
  ".epub": "document",
  ".zip": "archive",
  ".tar": "archive",
  ".gz": "archive",
  ".tgz": "archive",
  ".7z": "archive",
  ".rar": "archive",
  ".bz2": "archive",
  ".xz": "archive",
};

/** All extensions recognised as assets. */
export const ASSET_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(ASSET_TYPE_BY_EXTENSION));

/**
 * Classifies a file as an asset of a given type, or returns `null` when the
 * file is not an asset.
 *
 * @param input - The file to classify.
 * @returns The asset type, or `null`.
 */
export function classifyAssetFile(input: FileClassificationInput): AssetType | null {
  const type = ASSET_TYPE_BY_EXTENSION[input.extension.toLowerCase()];
  return type ?? null;
}
