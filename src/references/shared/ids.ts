import type { ReferenceKind } from "../models/index.js";

/**
 * Deterministic reference ids.
 *
 * Ids are pure functions of kind, source symbol and the reference's raw
 * discriminator, so they stay stable across resolution runs — a precondition
 * for the incremental binding cache and for diffing graphs.
 */

/** The name used for default imports/exports. */
export const DEFAULT_NAME = "default";

/** The name used for whole-module (namespace) imports/re-exports. */
export const STAR_NAME = "*";

/** Builds a stable reference id. */
export function referenceId(
  kind: ReferenceKind,
  fromId: string,
  name: string,
  specifier: string,
  sequence: number,
): string {
  return `ref:${kind}:${fromId}:${name}:${specifier}:${sequence}`;
}
