import type { Symbol } from "../../symbols/index.js";
import type { ModuleSymbol } from "../../symbols/index.js";
import type { ReferenceFileBindings } from "../models/index.js";
import { DEFAULT_NAME, STAR_NAME } from "../shared/index.js";
import { nameParts } from "../shared/index.js";

/** A resolved import binding for one module. */
export interface ScopeImport {
  readonly localName: string;
  readonly importedName: string;
  readonly specifier: string;
  readonly targetFile?: string;
  readonly targetModuleId?: string;
}

/** A re-export edge for one module. */
export interface ScopeReExport {
  readonly exportedName: string;
  readonly localName: string;
  readonly specifier?: string;
  readonly targetFile?: string;
  readonly targetModuleId?: string;
}

/** A local export-clause alias (`export { a as b }`). */
export interface ScopeExportAlias {
  readonly exportedName: string;
  readonly localName: string;
}

/** The resolution scope of a single module. */
export interface ModuleScope {
  readonly moduleId: string;
  readonly file: string;
  readonly languageId: string;
  /** Identifier → ids of direct child symbols. */
  readonly children: ReadonlyMap<string, readonly string[]>;
  /** Identifier → ids of directly exported child symbols. */
  readonly exportedChildren: ReadonlyMap<string, readonly string[]>;
  /** Ids of the module's default exports. */
  readonly defaultIds: readonly string[];
  readonly imports: readonly ScopeImport[];
  readonly starReExports: readonly ScopeReExport[];
  readonly namedReExports: readonly ScopeReExport[];
  /** Local export-clause aliases (`export { a as b }`). */
  readonly exportAliases: readonly ScopeExportAlias[];
}

/** Options for {@link buildModuleScopes}. */
export interface ModuleScopesInput {
  readonly symbols: ReadonlyMap<string, Symbol>;
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  /** Per-file bindings recovered by the language resolvers. */
  readonly bindings: ReadonlyMap<string, ReferenceFileBindings>;
  /** Resolves a specifier against an importing file into a relative file. */
  readonly resolveModule: (fromFile: string, specifier: string) => string | undefined;
}

/** A resolver function used by scopes; returns symbol ids. */
export type NameResolver = (moduleId: string, name: string) => readonly string[];

/**
 * The module scope index — the heart of reference resolution.
 *
 * Each module exposes its local declarations, effective exports (including
 * re-export chains) and import bindings. Names are resolved syntactically:
 * a name in module scope resolves against local declarations, import
 * bindings, the module's own exports and (transitively) its re-exports.
 */
export interface ModuleScopes {
  readonly symbols: ReadonlyMap<string, Symbol>;
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  scopeOf(moduleId: string): ModuleScope | undefined;
  moduleOf(file: string): ModuleSymbol | undefined;
  /** Resolves a name in module scope (local, imported, exported, re-exported). */
  resolveName(moduleId: string, name: string): readonly string[];
  /** Resolves an exported name (own exports + re-export chains only). */
  resolveImported(moduleId: string, name: string): readonly string[];
  /** Resolves a dotted name such as `NS.Type`. */
  resolveDotted(moduleId: string, name: string): readonly string[];
  /** Resolves an import target (`*`, `default` or a named export). */
  resolveImport(targetModuleId: string, importedName: string): readonly string[];
}

/**
 * Builds the module scope index. One scope per module symbol; bindings are
 * merged from the symbol model and the per-file resolver bindings.
 */
export function buildModuleScopes(input: ModuleScopesInput): ModuleScopes {
  const scopes = new Map<string, ModuleScope>();

  for (const module of input.modules.values()) {
    scopes.set(module.id, buildModuleScope(module, input));
  }

  const resolveNameImpl = (
    moduleId: string,
    name: string,
    visiting: Set<string>,
  ): readonly string[] => {
    const scope = scopes.get(moduleId);
    if (scope === undefined) return [];

    const local = scope.children.get(name);
    if (local !== undefined && local.length > 0) return local;

    for (const imp of scope.imports) {
      if (imp.localName !== name) continue;
      if (imp.targetModuleId === undefined) continue;
      const ids = resolveImportImpl(imp.targetModuleId, imp.importedName, visiting);
      if (ids.length > 0) return ids;
    }

    const exported = scope.exportedChildren.get(name);
    if (exported !== undefined && exported.length > 0) return exported;

    for (const re of scope.namedReExports) {
      if (re.exportedName !== name) continue;
      if (re.targetModuleId === undefined) continue;
      const ids =
        re.localName === STAR_NAME
          ? [re.targetModuleId]
          : resolveImportedImpl(re.targetModuleId, re.localName, visiting);
      if (ids.length > 0) return ids;
    }

    for (const re of scope.starReExports) {
      if (re.targetModuleId === undefined) continue;
      if (visiting.has(re.targetModuleId)) continue;
      visiting.add(re.targetModuleId);
      const ids = resolveNameImpl(re.targetModuleId, name, visiting);
      visiting.delete(re.targetModuleId);
      if (ids.length > 0) return ids;
    }

    return [];
  };

  const resolveImportedImpl = (
    moduleId: string,
    name: string,
    visiting: Set<string>,
  ): readonly string[] => {
    const scope = scopes.get(moduleId);
    if (scope === undefined) return [];
    if (name === DEFAULT_NAME) return scope.defaultIds;

    const exported = scope.exportedChildren.get(name);
    if (exported !== undefined && exported.length > 0) return exported;

    for (const re of scope.namedReExports) {
      if (re.exportedName !== name) continue;
      if (re.targetModuleId === undefined) continue;
      if (re.localName === STAR_NAME) return [re.targetModuleId];
      const ids = resolveImportedImpl(re.targetModuleId, re.localName, visiting);
      if (ids.length > 0) return ids;
    }

    for (const re of scope.starReExports) {
      if (re.targetModuleId === undefined) continue;
      if (visiting.has(re.targetModuleId)) continue;
      visiting.add(re.targetModuleId);
      const ids = resolveImportedImpl(re.targetModuleId, name, visiting);
      visiting.delete(re.targetModuleId);
      if (ids.length > 0) return ids;
    }

    return [];
  };

  const resolveImportImpl = (
    targetModuleId: string,
    importedName: string,
    visiting: Set<string>,
  ): readonly string[] => {
    if (importedName === STAR_NAME) return [targetModuleId];
    if (importedName === DEFAULT_NAME) return scopes.get(targetModuleId)?.defaultIds ?? [];
    return resolveImportedImpl(targetModuleId, importedName, visiting);
  };

  const memo = new Map<string, readonly string[]>();

  const resolverFor = (impl: NameResolver): NameResolver => {
    return (moduleId, name) => {
      const key = `${moduleId}\u0000${name}`;
      const cached = memo.get(key);
      if (cached !== undefined) return cached;
      const ids = impl(moduleId, name);
      memo.set(key, ids);
      return ids;
    };
  };

  const resolveName = resolverFor((moduleId, name) =>
    resolveNameImpl(moduleId, name, new Set([moduleId])),
  );
  const resolveImported = resolverFor((moduleId, name) =>
    resolveImportedImpl(moduleId, name, new Set([moduleId])),
  );
  const resolveImport = resolverFor((targetModuleId, importedName) =>
    resolveImportImpl(targetModuleId, importedName, new Set([targetModuleId])),
  );

  const resolveDotted = (moduleId: string, name: string): readonly string[] => {
    const parts = nameParts(name);
    if (parts.length <= 1) return resolveName(moduleId, name);
    const first = parts[0]!;
    const rest = parts.slice(1);
    const resolveNext = (ids: readonly string[], part: string): readonly string[] => {
      const next: string[] = [];
      for (const id of ids) {
        const symbol = input.symbols.get(id);
        if (symbol === undefined) continue;
        for (const childId of symbol.childrenIds) {
          const child = input.symbols.get(childId);
          if (child !== undefined && child.metadata.identifier === part) next.push(childId);
        }
      }
      return next;
    };
    let ids = resolveName(moduleId, first);
    for (const part of rest) {
      if (ids.length === 0) break;
      ids = resolveNext(ids, part);
    }
    return ids;
  };

  return {
    symbols: input.symbols,
    modules: input.modules,
    scopeOf: (moduleId) => scopes.get(moduleId),
    moduleOf: (file) => input.modules.get(file),
    resolveName,
    resolveImported,
    resolveDotted,
    resolveImport,
  };
}

function buildModuleScope(module: ModuleSymbol, input: ModuleScopesInput): ModuleScope {
  const file = module.metadata.location.file;
  const children = new Map<string, string[]>();
  const exportedChildren = new Map<string, string[]>();
  const defaultIds: string[] = [];

  for (const childId of module.childrenIds) {
    const child = input.symbols.get(childId);
    if (child === undefined) continue;
    const identifier = child.metadata.identifier;
    const ids = children.get(identifier) ?? [];
    ids.push(child.id);
    children.set(identifier, ids);
    if (child.metadata.exported) {
      const exportedIds = exportedChildren.get(identifier) ?? [];
      exportedIds.push(child.id);
      exportedChildren.set(identifier, exportedIds);
    }
    if (child.metadata.modifiers.includes("default")) defaultIds.push(child.id);
  }

  const aliases = input.bindings.get(file)?.exportAliases ?? [];
  for (const alias of aliases) {
    const local = children.get(alias.localName);
    if (local === undefined) continue;
    const existing = exportedChildren.get(alias.exportedName) ?? [];
    exportedChildren.set(alias.exportedName, [...existing, ...local]);
  }

  if (children.has(DEFAULT_NAME)) defaultIds.push(...children.get(DEFAULT_NAME)!);
  if (exportedChildren.has(DEFAULT_NAME)) {
    defaultIds.push(...exportedChildren.get(DEFAULT_NAME)!);
  }

  const imports: ScopeImport[] = [];
  for (const binding of input.bindings.get(file)?.imports ?? []) {
    const targetFile = input.resolveModule(file, binding.specifier);
    imports.push({
      localName: binding.localName,
      importedName: binding.importedName,
      specifier: binding.specifier,
      ...(targetFile !== undefined
        ? { targetFile, targetModuleId: input.modules.get(targetFile)?.id }
        : {}),
    });
  }

  const namedReExports: ScopeReExport[] = [];
  const seenNamed = new Set<string>();
  for (const re of input.bindings.get(file)?.reExports ?? []) {
    const targetFile = input.resolveModule(file, re.specifier ?? "");
    const targetModuleId = targetFile !== undefined ? input.modules.get(targetFile)?.id : undefined;
    const key = `${re.specifier ?? ""}\u0000${re.exportedName}`;
    if (seenNamed.has(key)) continue;
    seenNamed.add(key);
    namedReExports.push({
      exportedName: re.exportedName,
      localName: re.localName,
      ...(re.specifier !== undefined ? { specifier: re.specifier } : {}),
      ...(targetFile !== undefined
        ? { targetFile, targetModuleId }
        : targetModuleId !== undefined
          ? { targetModuleId }
          : {}),
    });
  }
  for (const re of module.reExports ?? []) {
    const targetFile = input.resolveModule(file, re.specifier);
    if (re.names === undefined) continue;
    for (const name of re.names) {
      const key = `${re.specifier}\u0000${name}`;
      if (seenNamed.has(key)) continue;
      seenNamed.add(key);
      namedReExports.push({
        exportedName: name,
        localName: name,
        specifier: re.specifier,
        ...(targetFile !== undefined
          ? { targetFile, targetModuleId: input.modules.get(targetFile)?.id }
          : {}),
      });
    }
  }

  const starReExports: ScopeReExport[] = [];
  const seenStar = new Set<string>();
  for (const re of module.reExports ?? []) {
    if (re.names !== undefined) continue;
    if (seenStar.has(re.specifier)) continue;
    seenStar.add(re.specifier);
    const targetFile = input.resolveModule(file, re.specifier);
    starReExports.push({
      exportedName: STAR_NAME,
      localName: STAR_NAME,
      specifier: re.specifier,
      ...(targetFile !== undefined
        ? { targetFile, targetModuleId: input.modules.get(targetFile)?.id }
        : {}),
    });
  }

  return {
    moduleId: module.id,
    file,
    languageId: module.metadata.languageId,
    children,
    exportedChildren,
    defaultIds: [...new Set(defaultIds)],
    imports,
    starReExports,
    namedReExports,
    exportAliases: Object.freeze(
      aliases
        .filter((alias) => alias.specifier === undefined)
        .map((alias) =>
          Object.freeze({ exportedName: alias.exportedName, localName: alias.localName }),
        ),
    ),
  };
}
