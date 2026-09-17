import type { ModuleSymbol, Symbol, SymbolRelationship } from "../models/index.js";
import { createSymbolRelationship } from "../models/index.js";

/** Resolves a module specifier relative to a file into a file path. */
export type ModuleResolver = (fromFile: string, specifier: string) => string | undefined;

/** Options controlling graph construction. */
export interface SymbolGraphOptions {
  /** Resolves import specifiers to files. */
  readonly resolveModule?: ModuleResolver;
}

/**
 * A structural symbol graph.
 *
 * The graph is derived, never annotated: edges are recomputed from the
 * symbols each build. Only structural relationships are modeled — no
 * semantic resolution happens here.
 */
export interface SymbolGraph {
  readonly nodes: ReadonlyMap<string, Symbol>;
  /** File path → module symbol. */
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  readonly relationships: readonly SymbolRelationship[];
  readonly relationshipsBySource: ReadonlyMap<string, readonly SymbolRelationship[]>;
  readonly relationshipsByTarget: ReadonlyMap<string, readonly SymbolRelationship[]>;

  findSymbol(id: string): Symbol | undefined;
  moduleOf(file: string): ModuleSymbol | undefined;
  importsOf(file: string): readonly string[];
  exportsOf(file: string): readonly string[];
}

/** Builds a {@link SymbolGraph} from module symbols and their descendants. */
export function buildSymbolGraph(
  symbols: readonly Symbol[],
  options: SymbolGraphOptions = {},
): SymbolGraph {
  const nodes = new Map<string, Symbol>();
  const modules = new Map<string, ModuleSymbol>();
  const relationships: SymbolRelationship[] = [];

  for (const symbol of symbols) {
    nodes.set(symbol.id, symbol);
    if (symbol.kind === "module") {
      const module = symbol as ModuleSymbol;
      modules.set(module.metadata.location.file, module);
    }
  }

  for (const symbol of symbols) {
    addDeclaredIn(relationships, symbol);
    addOwnership(relationships, symbol);
    if (symbol.parentId === undefined) continue;
    const parent = nodes.get(symbol.parentId);
    if (parent !== undefined && parent.kind === "module") {
      addExportedBy(relationships, parent, symbol);
    }
  }

  for (const module of modules.values()) {
    addModuleImports(relationships, module, options.resolveModule);
    addModuleReExports(relationships, module, options.resolveModule);
  }

  return freezeGraph(nodes, modules, relationships);
}

function addDeclaredIn(relationships: SymbolRelationship[], symbol: Symbol): void {
  if (symbol.metadata.location.file.length === 0) return;
  relationships.push(
    createSymbolRelationship({
      type: "declared-in",
      fromId: symbol.id,
      toFile: symbol.metadata.location.file,
    }),
  );
  relationships.push(
    createSymbolRelationship({
      type: "defined-in",
      fromId: symbol.id,
      toFile: symbol.metadata.location.file,
    }),
  );
}

function addOwnership(relationships: SymbolRelationship[], symbol: Symbol): void {
  if (symbol.parentId === undefined) return;
  relationships.push(
    createSymbolRelationship({
      type: "owns",
      fromId: symbol.parentId,
      toId: symbol.id,
    }),
  );
  relationships.push(
    createSymbolRelationship({
      type: "nested-inside",
      fromId: symbol.id,
      toId: symbol.parentId,
    }),
  );
}

function addExportedBy(relationships: SymbolRelationship[], module: Symbol, symbol: Symbol): void {
  if (!symbol.metadata.exported) return;
  relationships.push(
    createSymbolRelationship({
      type: "exported-by",
      fromId: module.id,
      toId: symbol.id,
      toFile: symbol.metadata.location.file,
    }),
  );
}

function addModuleImports(
  relationships: SymbolRelationship[],
  module: ModuleSymbol,
  resolveModule: ModuleResolver | undefined,
): void {
  for (const specifier of module.imports ?? []) {
    const file = module.metadata.location.file;
    const resolved = resolveModule?.(file, specifier);
    relationships.push(
      createSymbolRelationship({
        type: "imported-by",
        fromFile: file,
        ...(resolved !== undefined ? { toFile: resolved } : {}),
        module: specifier,
      }),
    );
  }
}

function addModuleReExports(
  relationships: SymbolRelationship[],
  module: ModuleSymbol,
  resolveModule: ModuleResolver | undefined,
): void {
  for (const re of module.reExports ?? []) {
    const file = module.metadata.location.file;
    const resolved = resolveModule?.(file, re.specifier);
    relationships.push(
      createSymbolRelationship({
        type: "re-exports",
        fromFile: file,
        ...(resolved !== undefined ? { toFile: resolved } : {}),
        module: re.specifier,
        ...(re.names !== undefined ? { names: re.names } : {}),
      }),
    );
  }
}

function freezeGraph(
  nodes: Map<string, Symbol>,
  modules: Map<string, ModuleSymbol>,
  relationships: SymbolRelationship[],
): SymbolGraph {
  const bySource = new Map<string, SymbolRelationship[]>();
  const byTarget = new Map<string, SymbolRelationship[]>();
  for (const relationship of relationships) {
    const sourceKey = relationship.fromId ?? relationship.fromFile ?? "";
    const targetKey = relationship.toId ?? relationship.toFile ?? "";
    if (sourceKey.length > 0) {
      bySource.set(sourceKey, [...(bySource.get(sourceKey) ?? []), relationship]);
    }
    if (targetKey.length > 0) {
      byTarget.set(targetKey, [...(byTarget.get(targetKey) ?? []), relationship]);
    }
  }

  return {
    nodes,
    modules,
    relationships: Object.freeze(relationships),
    relationshipsBySource: bySource,
    relationshipsByTarget: byTarget,

    findSymbol(id: string): Symbol | undefined {
      return nodes.get(id);
    },

    moduleOf(file: string): ModuleSymbol | undefined {
      return modules.get(file);
    },

    importsOf(file: string): readonly string[] {
      const module = modules.get(file);
      return module?.imports ?? [];
    },

    exportsOf(file: string): readonly string[] {
      const module = modules.get(file);
      if (module === undefined) return [];
      return module.exports ?? [];
    },
  };
}

/** Whether `symbol` is exported from its module. */
export function isExportedSymbol(symbol: Symbol): boolean {
  return symbol.metadata.exported;
}
