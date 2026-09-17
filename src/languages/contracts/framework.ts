/**
 * Framework association contract.
 *
 * Framework logic itself will come later; this phase only creates the
 * extension points that associate a language with the frameworks it powers.
 */
export interface FrameworkAssociation {
  /** Unique framework id (e.g. `nextjs`). */
  readonly id: string;
  /** Human-readable framework name (e.g. `Next.js`). */
  readonly name: string;
  /** Dependency names that indicate this framework (e.g. `next`). */
  readonly dependencies?: readonly string[];
  /** Default entry file basenames used by the framework. */
  readonly entryFiles?: readonly string[];
  /** Language ids this framework requires. */
  readonly requires?: readonly string[];
}
