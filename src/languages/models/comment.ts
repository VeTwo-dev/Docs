import type { CommentStandard, CommentStyle } from "../contracts/comment.js";
import { deepFreeze } from "./freeze.js";

/** An immutable documentation comment standard model. */
export interface CommentStandardModel {
  /** Unique standard id (e.g. `jsdoc`). */
  readonly id: string;
  /** Human-readable name (e.g. `JSDoc`). */
  readonly name: string;
  /** The comment style(s) the standard uses. */
  readonly style: readonly CommentStyle[];
  /** Syntax markers associated with the standard. */
  readonly markers: readonly string[];
  /** Optional human-readable description. */
  readonly description?: string;
}

/** Builds an immutable comment standard model. */
export function createCommentStandardModel(standard: CommentStandard): CommentStandardModel {
  const styles = Array.isArray(standard.style) ? standard.style : [standard.style];
  return deepFreeze({
    id: standard.id,
    name: standard.name,
    style: [...styles],
    markers: standard.markers !== undefined ? [...standard.markers] : [],
    ...(standard.description !== undefined ? { description: standard.description } : {}),
  });
}
