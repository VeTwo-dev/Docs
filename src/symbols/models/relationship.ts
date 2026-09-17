/**
 * Structural relationships between symbols and modules.
 *
 * Only structural relationships are recorded — never resolved semantic
 * references. Targets that cannot be linked to a known symbol (module
 * specifiers, re-export names) remain as raw `module`/`names` values.
 */
export type SymbolRelationshipType =
  /** Parent owns child. */
  | "owns"
  /** Child is nested inside parent. */
  | "nested-inside"
  /** A symbol is declared in a source file. */
  | "declared-in"
  /** A symbol is defined (implemented) in a source file. */
  | "defined-in"
  /** A module exports a symbol. */
  | "exported-by"
  /** A module imports another module. */
  | "imported-by"
  /** A module re-exports from another module. */
  | "re-exports";

/** A structural edge in the symbol graph. */
export interface SymbolRelationship {
  readonly type: SymbolRelationshipType;
  /** The source symbol id. */
  readonly fromId?: string;
  /** The target symbol id. */
  readonly toId?: string;
  /** The source file path (for file-level relationships). */
  readonly fromFile?: string;
  /** The target file path (for file-level relationships). */
  readonly toFile?: string;
  /** The target module specifier (for imports/re-exports). */
  readonly module?: string;
  /** Re-exported names; `undefined` means all. */
  readonly names?: readonly string[];
}

/** Input required to build a {@link SymbolRelationship}. */
export interface SymbolRelationshipInput {
  readonly type: SymbolRelationshipType;
  readonly fromId?: string;
  readonly toId?: string;
  readonly fromFile?: string;
  readonly toFile?: string;
  readonly module?: string;
  readonly names?: readonly string[];
}

/** Builds an immutable {@link SymbolRelationship}. */
export function createSymbolRelationship(input: SymbolRelationshipInput): SymbolRelationship {
  return Object.freeze({
    type: input.type,
    ...(input.fromId !== undefined ? { fromId: input.fromId } : {}),
    ...(input.toId !== undefined ? { toId: input.toId } : {}),
    ...(input.fromFile !== undefined ? { fromFile: input.fromFile } : {}),
    ...(input.toFile !== undefined ? { toFile: input.toFile } : {}),
    ...(input.module !== undefined ? { module: input.module } : {}),
    ...(input.names !== undefined ? { names: Object.freeze([...input.names]) } : {}),
  });
}
