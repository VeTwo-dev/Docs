/**
 * Documentation comment standards.
 *
 * This phase prepares support for multiple documentation standards (JSDoc,
 * TSDoc, Python docstrings, Rustdoc, JavaDoc, ...). The contracts are defined
 * here but the standards are not parsed yet.
 */
export type CommentStyle = "line" | "block" | "docblock" | "string" | "annotation";

/** A documentation comment standard declared by a language adapter. */
export interface CommentStandard {
  /** Unique standard id (e.g. `jsdoc`). */
  readonly id: string;
  /** Human-readable name (e.g. `JSDoc`). */
  readonly name: string;
  /** The comment style(s) the standard uses. */
  readonly style: CommentStyle | readonly CommentStyle[];
  /** Syntax markers associated with the standard (e.g. `/**`). */
  readonly markers?: readonly string[];
  /** Optional human-readable description. */
  readonly description?: string;
}
