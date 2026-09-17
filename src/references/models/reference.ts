import type { CompilerRange } from "../../compiler/index.js";

/**
 * Universal reference kinds.
 *
 * The vocabulary is language-independent: resolvers map their native
 * constructs onto these kinds. References are structural — every reference
 * records what name or specifier was used, and (when possible) which symbol
 * it resolves to. No semantic analysis is performed.
 *
 * The core structural kinds from Phase 5 are kept byte-compatible; the kind
 * set has since been expanded to cover packages, workspaces, ownership,
 * inheritance/implementation, calls and cycles.
 */
export const REFERENCE_KINDS = [
  /** A module imports another module (`import "./x"`, `import x from`, ...). */
  "import",
  /** A named/default import binds a target module's export. */
  "import-name",
  /** A module exports a local symbol. */
  "export",
  /** A module re-exports from another module (star or named). */
  "re-export",
  /** A class/interface extends or implements a named symbol. */
  "heritage",
  /** A type alias names another symbol. */
  "type-use",

  /** An import or export alias maps a local name to a remote name. */
  "alias",
  /** A module-level reference that resolved to a file/module. */
  "module",
  /** A bare specifier resolved to an external package. */
  "package",
  /** A specifier resolved to a workspace package. */
  "workspace",
  /** A package.json dependency relationship. */
  "dependency",
  /** A class implements an interface. */
  "implements",
  /** A symbol is contained by a parent symbol (structure). */
  "containment",
  /** An explicit ownership edge in an ownership chain. */
  "ownership",
  /** A symbol composes/uses another (has-a). */
  "composition",
  /** A function/method call site referencing a target symbol. */
  "call",
  /** A class/interface extends another. */
  "extends",
  /** A symbol uses another symbol or type. */
  "uses",
  /** A detected cycle (imports, inheritance, packages, workspaces). */
  "circular",
  /** A reference whose kind is not recognized. */
  "unknown",
] as const;

/** The kind of a {@link Reference}. */
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** Whether `kind` is a known reference kind. */
export function isReferenceKind(kind: string): kind is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(kind);
}

/** Dependency kinds tracked by package.json resolution. */
export const DEPENDENCY_TYPES = ["runtime", "dev", "peer", "optional"] as const;

/** The kind of a {@link DependencyReference}. */
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/**
 * Kind-specific payload carried by a {@link Reference}.
 *
 * The base reference keeps its Phase 5 shape; payload fields are additive and
 * optional, so older references (and code that builds them) remain valid.
 */
export interface ReferencePayload {
  /** The local alias name (alias references). */
  readonly aliasName?: string;
  /** The remote name an alias points at (alias references). */
  readonly targetName?: string;
  /** The resolved package name (package/dependency references). */
  readonly packageName?: string;
  /** The resolved workspace package name (workspace references). */
  readonly workspaceName?: string;
  /** The dependency kind (dependency references). */
  readonly dependencyType?: DependencyType;
  /** The declaring parent symbol id (containment/ownership references). */
  readonly parentId?: string;
  /** The contained child symbol id (containment references). */
  readonly childId?: string;
  /** The owning symbol id (ownership references). */
  readonly ownerId?: string;
  /** The ordered symbol ids of a detected cycle (circular references). */
  readonly cycleIds?: readonly string[];
  /** Why a reference is unknown (unknown references). */
  readonly reason?: string;
}

/**
 * A resolved or unresolved reference.
 *
 * A reference always carries its source (`fromId`) and its raw name or
 * specifier. When the target is known it also carries `toId` (a symbol) and/or
 * `toFile` (a module file). Unresolved references keep their raw values so the
 * caller can report them.
 */
export interface Reference {
  /** The unique reference id within a resolution run. */
  readonly id: string;
  readonly kind: ReferenceKind;
  /** The source symbol id (a module, class, interface or type alias). */
  readonly fromId: string;
  /** The referenced name (exported/imported/heritage/type name). */
  readonly name?: string;
  /** The module specifier for import/re-export references. */
  readonly specifier?: string;
  /** The resolved target symbol id, when known. */
  readonly toId?: string;
  /** The resolved target module file, when known. */
  readonly toFile?: string;
  /** The source range of the reference, when known. */
  readonly range?: CompilerRange;
  /** Whether the reference resolved to a symbol or module. */
  readonly resolved: boolean;
  /** Kind-specific payload (additive, optional). */
  readonly payload?: ReferencePayload;
}

/** Input required to build a {@link Reference}. */
export interface ReferenceInput {
  readonly kind: ReferenceKind;
  readonly fromId: string;
  readonly name?: string;
  readonly specifier?: string;
  readonly toId?: string;
  readonly toFile?: string;
  readonly range?: CompilerRange;
  readonly payload?: ReferencePayload;
}

/** Builds an immutable {@link Reference}. */
export function createReference(input: ReferenceInput, id: string): Reference {
  const resolved = input.toId !== undefined || input.toFile !== undefined;
  return Object.freeze({
    id,
    kind: input.kind,
    fromId: input.fromId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.specifier !== undefined ? { specifier: input.specifier } : {}),
    ...(input.toId !== undefined ? { toId: input.toId } : {}),
    ...(input.toFile !== undefined ? { toFile: input.toFile } : {}),
    ...(input.range !== undefined ? { range: input.range } : {}),
    ...(input.payload !== undefined ? { payload: Object.freeze({ ...input.payload }) } : {}),
    resolved,
  });
}

/** Whether a reference resolved to a concrete symbol. */
export function isResolvedReference(reference: Reference): boolean {
  return reference.resolved && reference.toId !== undefined;
}

/** Whether a reference resolved to a module/file but not a specific symbol. */
export function isModuleReference(reference: Reference): boolean {
  return reference.resolved && reference.toId === undefined && reference.toFile !== undefined;
}

/** Whether a reference is unresolved. */
export function isUnresolvedReference(reference: Reference): boolean {
  return !reference.resolved;
}

/** An import reference (module-level or named). */
export interface ImportReference extends Reference {
  readonly kind: "import" | "import-name";
}

/** An export reference. */
export interface ExportReference extends Reference {
  readonly kind: "export";
}

/** A re-export reference (star or named). */
export interface ReExportReference extends Reference {
  readonly kind: "re-export";
}

/** An import/export alias reference. */
export interface AliasReference extends Reference {
  readonly kind: "alias";
}

/** A module-level reference resolved to a file. */
export interface ModuleReference extends Reference {
  readonly kind: "module";
}

/** A bare-specifier reference resolved to an external package. */
export interface PackageReference extends Reference {
  readonly kind: "package";
}

/** A reference resolved to a workspace package. */
export interface WorkspaceReference extends Reference {
  readonly kind: "workspace";
}

/** A package.json dependency reference. */
export interface DependencyReference extends Reference {
  readonly kind: "dependency";
}

/** A heritage reference (extends or implements). */
export interface InheritanceReference extends Reference {
  readonly kind: "heritage";
}

/** A class-implements-interface reference. */
export interface ImplementationReference extends Reference {
  readonly kind: "implements";
}

/** A parent-contains-child reference. */
export interface ContainmentReference extends Reference {
  readonly kind: "containment";
}

/** An explicit ownership edge. */
export interface OwnershipReference extends Reference {
  readonly kind: "ownership";
}

/** A has-a composition reference. */
export interface CompositionReference extends Reference {
  readonly kind: "composition";
}

/** A type alias reference to another symbol. */
export interface TypeReference extends Reference {
  readonly kind: "type-use";
}

/** A call site reference. */
export interface CallReference extends Reference {
  readonly kind: "call";
}

/** An extends reference. */
export interface ExtendsReference extends Reference {
  readonly kind: "extends";
}

/** An implements reference. */
export interface ImplementsReference extends Reference {
  readonly kind: "implements";
}

/** A uses reference. */
export interface UsesReference extends Reference {
  readonly kind: "uses";
}

/** A detected circular reference. */
export interface CircularReference extends Reference {
  readonly kind: "circular";
}

/** A reference whose kind could not be classified. */
export interface UnknownReference extends Reference {
  readonly kind: "unknown";
}

/** The discriminated union of all universal reference models. */
export type ReferenceModel =
  | ImportReference
  | ExportReference
  | ReExportReference
  | AliasReference
  | ModuleReference
  | PackageReference
  | WorkspaceReference
  | DependencyReference
  | InheritanceReference
  | ImplementationReference
  | ContainmentReference
  | OwnershipReference
  | CompositionReference
  | TypeReference
  | CallReference
  | ExtendsReference
  | ImplementsReference
  | UsesReference
  | CircularReference
  | UnknownReference;

/** The collection of reference models. */
export const REFERENCE_MODELS = [
  "import",
  "import-name",
  "export",
  "re-export",
  "alias",
  "module",
  "package",
  "workspace",
  "dependency",
  "inheritance",
  "implementation",
  "containment",
  "ownership",
  "composition",
  "type",
  "call",
  "extends",
  "implements",
  "uses",
  "circular",
  "unknown",
] as const;
