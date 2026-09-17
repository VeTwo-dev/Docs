import type { Symbol } from "../../symbols/index.js";
import type { ModuleSymbol } from "../../symbols/index.js";
import type { Reference } from "../models/index.js";
import { createReference } from "../models/index.js";
import type { ModuleScopes } from "../scope/index.js";
import { referenceId } from "../shared/index.js";
import type { OwnershipTree } from "../ownership/index.js";
import { classifySpecifier, packageNameOf, resolvePackage } from "../resolution/index.js";
import type { PackageInfo } from "../../types/public.js";

/** Options for {@link buildReferenceGraph}. */
export interface ReferenceGraphInput {
  readonly symbols: ReadonlyMap<string, Symbol>;
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  readonly scopes: ModuleScopes;
  /** Resolves a specifier against an importing file into a relative file. */
  readonly resolveModule: (fromFile: string, specifier: string) => string | undefined;
  /** Package metadata used to classify bare specifiers. */
  readonly packages?: readonly PackageInfo[];
  /** The ownership tree used to emit ownership/containment edges. */
  readonly ownership?: OwnershipTree;
  /** When provided, only these module files are (re)built; others are reused. */
  readonly moduleFilter?: ReadonlySet<string>;
}

/**
 * The universal reference graph.
 *
 * Nodes are symbols; edges are resolved or unresolved references. Every edge
 * is recomputed from the symbols, bindings and scopes on each build — the
 * graph is derived, never annotated.
 */
export interface ReferenceGraph {
  readonly references: readonly Reference[];
  readonly symbols: ReadonlyMap<string, Symbol>;
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  /** Source symbol id → outgoing references. */
  readonly bySource: ReadonlyMap<string, readonly Reference[]>;
  /** Target symbol id → incoming references. */
  readonly byTarget: ReadonlyMap<string, readonly Reference[]>;
  /** Source file → references whose source symbol lives there. */
  readonly byFile: ReadonlyMap<string, readonly Reference[]>;

  findSymbol(id: string): Symbol | undefined;
  moduleOf(file: string): ModuleSymbol | undefined;
  referencesOf(id: string): readonly Reference[];
  referencedBy(id: string): readonly Reference[];
  importsOf(file: string): readonly string[];
  exportsOf(file: string): readonly string[];
  /** Files the module (transitively) imports or re-exports. */
  dependenciesOf(file: string): readonly string[];
  /** Files that import or re-export this module. */
  dependentsOf(file: string): readonly string[];
  /** Every reference touching a symbol (outgoing + incoming). */
  findReferences(symbolId: string): readonly Reference[];
  /** Incoming references (symbols that reference `symbolId`). */
  findIncomingReferences(symbolId: string): readonly Reference[];
  /** Outgoing references (references from `symbolId`). */
  findOutgoingReferences(symbolId: string): readonly Reference[];
  /** Files the module depends on (transitive import/re-export closure). */
  findDependencies(symbolId: string): readonly string[];
  /** Files that depend on the module (transitive reverse closure). */
  findDependents(symbolId: string): readonly string[];
  /** The ownership chain of a symbol (self → ... → root). */
  findOwners(symbolId: string): readonly string[];
  /** Symbols this symbol inherits from (transitive heritage/extends). */
  findInheritedSymbols(symbolId: string): readonly string[];
  /** Symbols that implement/extends this interface or class. */
  findImplementations(symbolId: string): readonly string[];
}

/**
 * Resolves every reference between the given symbols and builds the graph.
 * Reference creation is deterministic: ids are pure functions of the input.
 */
/**
 * Builds the reference edges for the modules that pass the filter.
 *
 * When `moduleFilter` is provided, ownership/dependency edges are still
 * rebuilt (they are global), while per-module edges are only built for the
 * filtered files — enabling incremental reuse of unchanged modules.
 */
export function buildReferenceEdges(input: ReferenceGraphInput): Reference[] {
  const references: Reference[] = [];
  let sequence = 0;

  const isIncluded = (file: string): boolean =>
    input.moduleFilter === undefined || input.moduleFilter.has(file);

  for (const module of input.modules.values()) {
    const file = module.metadata.location.file;
    if (!isIncluded(file)) continue;
    addModuleImports(references, module, file, input, () => sequence++);
    addBareImports(references, module, input, () => sequence++);
    addImportNames(references, module, input, () => sequence++);
    addModuleExports(references, module, input, () => sequence++);
    addExportAliases(references, module, input, () => sequence++);
    addModuleReExports(references, module, file, input, () => sequence++);
    addHeritageAndTypeUses(references, module, input, () => sequence++);
  }

  if (input.ownership !== undefined) {
    addOwnershipEdges(references, input, () => sequence++);
  }
  addDependencies(references, input, () => sequence++);

  return references;
}

/** Builds the full reference graph from an edge list. */
export function createReferenceGraph(
  references: readonly Reference[],
  symbols: ReadonlyMap<string, Symbol>,
  modules: ReadonlyMap<string, ModuleSymbol>,
): ReferenceGraph {
  return freezeGraph(references, symbols, modules);
}

export function buildReferenceGraph(input: ReferenceGraphInput): ReferenceGraph {
  return freezeGraph(buildReferenceEdges(input), input.symbols, input.modules);
}

function addModuleImports(
  references: Reference[],
  module: ModuleSymbol,
  file: string,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  for (const specifier of new Set(module.imports ?? [])) {
    const targetFile = input.resolveModule(file, specifier);
    const targetModule = targetFile !== undefined ? input.modules.get(targetFile) : undefined;
    references.push(
      createReference(
        {
          kind: "import",
          fromId: module.id,
          specifier,
          ...(targetModule !== undefined
            ? { toId: targetModule.id, toFile: targetFile }
            : targetFile !== undefined
              ? { toFile: targetFile }
              : {}),
        },
        referenceId("import", module.id, "", specifier, nextSequence()),
      ),
    );
  }
}

function addImportNames(
  references: Reference[],
  module: ModuleSymbol,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  const scope = input.scopes.scopeOf(module.id);
  if (scope === undefined) return;
  for (const binding of scope.imports) {
    const ids =
      binding.targetModuleId !== undefined
        ? input.scopes.resolveImport(binding.targetModuleId, binding.importedName)
        : [];
    references.push(
      createReference(
        {
          kind: "import-name",
          fromId: module.id,
          name: binding.localName,
          specifier: binding.specifier,
          ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
        },
        referenceId("import-name", module.id, binding.localName, binding.specifier, nextSequence()),
      ),
    );
  }
}

/**
 * Classifies bare (non-relative) import specifiers into workspace or package
 * references, resolving against package metadata when available.
 */
function addBareImports(
  references: Reference[],
  module: ModuleSymbol,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  for (const specifier of new Set(module.imports ?? [])) {
    const workspaceNames = new Set((input.packages ?? []).map((pkg) => pkg.name));
    const classification = classifySpecifier(specifier, workspaceNames);
    if (classification === "module" || classification === "unknown") continue;

    const kind = classification === "workspace" ? "workspace" : "package";
    const packageName = packageNameOf(specifier);
    const pkg =
      input.packages !== undefined ? resolvePackage(input.packages, specifier) : undefined;
    const resolved = pkg !== undefined || classification === "workspace";
    references.push(
      createReference(
        {
          kind,
          fromId: module.id,
          specifier,
          ...(classification === "workspace"
            ? { payload: { workspaceName: packageName } }
            : pkg !== undefined
              ? { payload: { packageName }, toFile: pkg.main ?? pkg.types }
              : { payload: { packageName } }),
        },
        referenceId(kind, module.id, "", specifier, nextSequence()),
      ),
    );
    void resolved;
  }
}

/** Emits alias references for local export-clause aliases (`export { a as b }`). */
function addExportAliases(
  references: Reference[],
  module: ModuleSymbol,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  const scope = input.scopes.scopeOf(module.id);
  if (scope === undefined) return;
  for (const alias of scope.exportAliases) {
    const ids = input.scopes.resolveImported(module.id, alias.localName);
    references.push(
      createReference(
        {
          kind: "alias",
          fromId: module.id,
          name: alias.exportedName,
          payload: { aliasName: alias.exportedName, targetName: alias.localName },
          ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
        },
        referenceId("alias", module.id, alias.exportedName, "", nextSequence()),
      ),
    );
  }
}

/** Emits ownership and containment edges from the ownership tree. */
function addOwnershipEdges(
  references: Reference[],
  input: ReferenceGraphInput,
  _nextSequence: () => number,
): void {
  for (const node of input.ownership!.nodes.values()) {
    if (node.parentId === undefined) continue;
    const fromId = node.parentId;
    if (!input.symbols.has(fromId)) continue;
    references.push(
      createReference(
        {
          kind: "ownership",
          fromId,
          toId: node.id,
          payload: { ownerId: fromId, childId: node.id },
        },
        referenceId("ownership", fromId, node.id, "", 0),
      ),
    );
    references.push(
      createReference(
        {
          kind: "containment",
          fromId,
          toId: node.id,
          payload: { parentId: fromId, childId: node.id },
        },
        referenceId("containment", fromId, node.id, "", 0),
      ),
    );
  }
}

/** Emits dependency references from package metadata. */
function addDependencies(
  references: Reference[],
  input: ReferenceGraphInput,
  _nextSequence: () => number,
): void {
  if (input.packages === undefined) return;
  for (const pkg of input.packages) {
    const pkgSymbol = [...input.symbols.values()].find(
      (symbol) => symbol.kind === "package" && symbol.name === pkg.name,
    );
    if (pkgSymbol === undefined) continue;
    for (const dependency of packageDependenciesOf(pkg)) {
      references.push(
        createReference(
          {
            kind: "dependency",
            fromId: pkgSymbol.id,
            name: dependency.name,
            payload: { packageName: dependency.name, dependencyType: dependency.type },
            ...(input.packages.some((candidate) => candidate.name === dependency.name)
              ? { toId: pkgSymbol.id, toFile: dependency.name }
              : {}),
          },
          referenceId("dependency", pkgSymbol.id, dependency.name, dependency.type, 0),
        ),
      );
    }
  }
}

/** Package dependency names from the exported package info. */
function packageDependenciesOf(
  pkg: PackageInfo,
): readonly { name: string; type: "runtime" | "dev" | "peer" | "optional" }[] {
  const result: { name: string; type: "runtime" | "dev" | "peer" | "optional" }[] = [];
  for (const name of Object.keys(pkg.dependencies ?? {})) result.push({ name, type: "runtime" });
  for (const name of Object.keys(pkg.devDependencies ?? {})) result.push({ name, type: "dev" });
  for (const name of Object.keys(pkg.peerDependencies ?? {})) result.push({ name, type: "peer" });
  for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
    result.push({ name, type: "optional" });
  }
  return result;
}

function addModuleExports(
  references: Reference[],
  module: ModuleSymbol,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  for (const name of module.exports ?? []) {
    const ids = input.scopes.resolveImported(module.id, name);
    references.push(
      createReference(
        {
          kind: "export",
          fromId: module.id,
          name,
          ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
        },
        referenceId("export", module.id, name, "", nextSequence()),
      ),
    );
  }
}

function addModuleReExports(
  references: Reference[],
  module: ModuleSymbol,
  file: string,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  for (const re of module.reExports ?? []) {
    const targetFile = input.resolveModule(file, re.specifier);
    const targetModule = targetFile !== undefined ? input.modules.get(targetFile) : undefined;
    if (re.names === undefined) {
      references.push(
        createReference(
          {
            kind: "re-export",
            fromId: module.id,
            specifier: re.specifier,
            ...(targetModule !== undefined
              ? { toId: targetModule.id, toFile: targetFile }
              : targetFile !== undefined
                ? { toFile: targetFile }
                : {}),
          },
          referenceId("re-export", module.id, "", re.specifier, nextSequence()),
        ),
      );
      continue;
    }
    for (const name of re.names) {
      const ids =
        targetModule !== undefined ? input.scopes.resolveImported(targetModule.id, name) : [];
      references.push(
        createReference(
          {
            kind: "re-export",
            fromId: module.id,
            name,
            specifier: re.specifier,
            ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
          },
          referenceId("re-export", module.id, name, re.specifier, nextSequence()),
        ),
      );
    }
  }
}

function addHeritageAndTypeUses(
  references: Reference[],
  module: ModuleSymbol,
  input: ReferenceGraphInput,
  nextSequence: () => number,
): void {
  for (const childId of module.childrenIds) {
    const symbol = input.symbols.get(childId);
    if (symbol === undefined) continue;
    if ((symbol.kind === "class" || symbol.kind === "interface") && symbol.heritage !== undefined) {
      for (const name of symbol.heritage) {
        const ids = input.scopes.resolveDotted(module.id, name);
        references.push(
          createReference(
            {
              kind: "heritage",
              fromId: symbol.id,
              name,
              ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
            },
            referenceId("heritage", symbol.id, name, "", nextSequence()),
          ),
        );
        const target = ids[0] !== undefined ? input.symbols.get(ids[0]) : undefined;
        if (target !== undefined) {
          const specificKind =
            target.kind === "class"
              ? "extends"
              : target.kind === "interface"
                ? "implements"
                : undefined;
          if (specificKind !== undefined) {
            references.push(
              createReference(
                {
                  kind: specificKind,
                  fromId: symbol.id,
                  name,
                  ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
                },
                referenceId(specificKind, symbol.id, name, "", nextSequence()),
              ),
            );
          }
        }
      }
    }
    if (symbol.kind === "type-alias" && symbol.typeName !== undefined) {
      const ids = input.scopes.resolveDotted(module.id, symbol.typeName);
      references.push(
        createReference(
          {
            kind: "type-use",
            fromId: symbol.id,
            name: symbol.typeName,
            ...(ids[0] !== undefined ? { toId: ids[0] } : {}),
          },
          referenceId("type-use", symbol.id, symbol.typeName, "", nextSequence()),
        ),
      );
    }
  }
}

function freezeGraph(
  references: readonly Reference[],
  symbols: ReadonlyMap<string, Symbol>,
  modules: ReadonlyMap<string, ModuleSymbol>,
): ReferenceGraph {
  const bySource = new Map<string, Reference[]>();
  const byTarget = new Map<string, Reference[]>();
  const byFile = new Map<string, Reference[]>();

  for (const reference of references) {
    bySource.set(reference.fromId, [...(bySource.get(reference.fromId) ?? []), reference]);
    if (reference.toId !== undefined) {
      byTarget.set(reference.toId, [...(byTarget.get(reference.toId) ?? []), reference]);
    }
    const symbol = symbols.get(reference.fromId);
    const file = symbol?.metadata.location.file;
    if (file !== undefined && file.length > 0) {
      byFile.set(file, [...(byFile.get(file) ?? []), reference]);
    }
  }

  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const reference of references) {
    if (reference.toFile === undefined) continue;
    const fromSymbol = symbols.get(reference.fromId);
    const fromFile = fromSymbol?.metadata.location.file;
    if (fromFile !== undefined) {
      const key = fromFile;
      const list = dependencies.get(key) ?? [];
      if (!list.includes(reference.toFile)) list.push(reference.toFile);
      dependencies.set(key, list);
      const inverse = dependents.get(reference.toFile) ?? [];
      if (!inverse.includes(fromFile)) inverse.push(fromFile);
      dependents.set(reference.toFile, inverse);
    }
  }

  const freezeMaps = (map: Map<string, Reference[]>): ReadonlyMap<string, readonly Reference[]> => {
    const frozen = new Map<string, readonly Reference[]>();
    for (const [key, value] of map) frozen.set(key, Object.freeze(value));
    return frozen;
  };

  return {
    references: Object.freeze(references),
    symbols,
    modules,
    bySource: freezeMaps(bySource),
    byTarget: freezeMaps(byTarget),
    byFile: freezeMaps(byFile),

    findSymbol(id: string): Symbol | undefined {
      return symbols.get(id);
    },

    moduleOf(file: string): ModuleSymbol | undefined {
      return modules.get(file);
    },

    referencesOf(id: string): readonly Reference[] {
      return bySource.get(id) ?? [];
    },

    referencedBy(id: string): readonly Reference[] {
      return byTarget.get(id) ?? [];
    },

    importsOf(file: string): readonly string[] {
      const module = modules.get(file);
      return module?.imports ?? [];
    },

    exportsOf(file: string): readonly string[] {
      const module = modules.get(file);
      return module?.exports ?? [];
    },

    dependenciesOf(file: string): readonly string[] {
      return Object.freeze([...(dependencies.get(file) ?? [])].sort());
    },

    dependentsOf(file: string): readonly string[] {
      return Object.freeze([...(dependents.get(file) ?? [])].sort());
    },

    findReferences(symbolId: string): readonly Reference[] {
      const incoming = byTarget.get(symbolId) ?? [];
      const outgoing = bySource.get(symbolId) ?? [];
      return Object.freeze([...incoming, ...outgoing]);
    },

    findIncomingReferences(symbolId: string): readonly Reference[] {
      return byTarget.get(symbolId) ?? [];
    },

    findOutgoingReferences(symbolId: string): readonly Reference[] {
      return bySource.get(symbolId) ?? [];
    },

    findDependencies(symbolId: string): readonly string[] {
      const symbol = symbols.get(symbolId);
      const file = symbol?.metadata.location.file;
      if (file === undefined || file.length === 0) return Object.freeze([]);
      const visited = new Set<string>();
      const stack = [file];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const next = dependencies.get(current) ?? [];
        for (const target of next) {
          if (!visited.has(target)) stack.push(target);
        }
      }
      visited.delete(file);
      return Object.freeze([...visited].sort());
    },

    findDependents(symbolId: string): readonly string[] {
      const symbol = symbols.get(symbolId);
      const file = symbol?.metadata.location.file;
      if (file === undefined || file.length === 0) return Object.freeze([]);
      const visited = new Set<string>();
      const stack = [file];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const next = dependents.get(current) ?? [];
        for (const target of next) {
          if (!visited.has(target)) stack.push(target);
        }
      }
      visited.delete(file);
      return Object.freeze([...visited].sort());
    },

    findOwners(symbolId: string): readonly string[] {
      const chain: string[] = [];
      let current = symbols.get(symbolId);
      const seen = new Set<string>();
      while (current !== undefined && !seen.has(current.id)) {
        seen.add(current.id);
        chain.push(current.id);
        current = current.parentId !== undefined ? symbols.get(current.parentId) : undefined;
      }
      return Object.freeze(chain);
    },

    findInheritedSymbols(symbolId: string): readonly string[] {
      const inherited = new Set<string>();
      const stack = [...(bySource.get(symbolId) ?? [])];
      while (stack.length > 0) {
        const reference = stack.pop()!;
        if (reference.kind !== "heritage" || reference.toId === undefined) continue;
        if (inherited.has(reference.toId)) continue;
        inherited.add(reference.toId);
        for (const childReference of bySource.get(reference.toId) ?? []) stack.push(childReference);
      }
      return Object.freeze([...inherited].sort());
    },

    findImplementations(symbolId: string): readonly string[] {
      const implementations = new Set<string>();
      const stack = [...(byTarget.get(symbolId) ?? [])];
      while (stack.length > 0) {
        const reference = stack.pop()!;
        if (reference.kind !== "heritage") continue;
        if (implementations.has(reference.fromId)) continue;
        implementations.add(reference.fromId);
        for (const childReference of byTarget.get(reference.fromId) ?? []) {
          stack.push(childReference);
        }
      }
      return Object.freeze([...implementations].sort());
    },
  };
}
