import type { AssetType } from "../types/categories.js";
import type { FileModel } from "./file.js";

/** An immutable model of a detected asset file. */
export interface AssetModel {
  /** The underlying file model. */
  readonly file: FileModel;
  /** The detected asset type. */
  readonly type: AssetType;
  /** Image dimensions, when the provider could determine them. */
  readonly width?: number;
  /** Image dimensions, when the provider could determine them. */
  readonly height?: number;
  /** MIME type, when known. */
  readonly contentType?: string;
}

/** Input required to build an {@link AssetModel}. */
export interface AssetModelInput {
  readonly file: FileModel;
  readonly type: AssetType;
  readonly width?: number;
  readonly height?: number;
  readonly contentType?: string;
}

/** Builds an immutable, frozen {@link AssetModel}. */
export function createAssetModel(input: AssetModelInput): AssetModel {
  return Object.freeze({
    file: input.file,
    type: input.type,
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
  });
}
