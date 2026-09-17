import type { CompilerRange, CompilationUnit, SyntaxNode } from "../../compiler/index.js";
import { nowMs } from "../../compiler/index.js";
import type { SymbolKind } from "../models/kind.js";
import type { DocumentationComment, SymbolCompilerMetadata } from "../models/metadata.js";
import type { Symbol, SymbolInput, SymbolReExport } from "../models/symbol.js";
import { buildSymbols } from "../models/symbol.js";
import type { SymbolDiagnostic } from "../models/diagnostic.js";
import { createSymbolDiagnostic } from "../models/diagnostic.js";
import type { SymbolExtractionInput } from "../contracts/input.js";
import type { SymbolExtractionOutput, SymbolExtractionStatistics } from "../contracts/output.js";
import type { SymbolExtractor } from "../contracts/extractor.js";
import { createSymbolExtractor } from "../contracts/extractor.js";
import type { KnownSymbolCapability, SymbolCapabilityValue } from "../contracts/capabilities.js";
import { moduleSymbolId, overloadId, packageSymbolId, symbolId } from "../shared/id.js";
import { stableHash } from "../shared/hash.js";
import { joinQualifiedName, moduleNameOf } from "../shared/names.js";
import { hasDocumentationTag, parseDocumentationComment } from "../shared/doc.js";
import { detectSymbolDiagnostics } from "../diagnostics/index.js";

/** Options for the shared node-walk extractor factory. */
export interface NodeExtractorConfig {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly languageId: string;
  /** Maps a normalized node kind string to a symbol kind. */
  readonly kindFor: (nodeKind: string) => SymbolKind;
  /** The documentation comment format produced by the tree builder. */
  readonly docFormat: DocumentationComment["format"];
  readonly capabilities?: Partial<Record<KnownSymbolCapability, SymbolCapabilityValue>>;
}

/** A set of node kinds treated as class/interface members. */
const CLASS_MEMBER_KINDS = new Set([
  "MethodDeclaration",
  "MethodSignature",
  "Constructor",
  "GetAccessor",
  "SetAccessor",
  "PropertyDeclaration",
  "PropertySignature",
  "ClassProperty",
  "ClassPrivateProperty",
  "ClassAccessorProperty",
  "ClassMethod",
  "ClassPrivateMethod",
  "ClassAccessorMethod",
  "IndexSignature",
]);

/** Node kinds that declare an identifier. */
const DECLARABLE_KINDS = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunction",
  "ClassDeclaration",
  "InterfaceDeclaration",
  "TypeAliasDeclaration",
  "EnumDeclaration",
  "ModuleDeclaration",
  "MethodDeclaration",
  "MethodSignature",
  "Constructor",
  "GetAccessor",
  "SetAccessor",
  "PropertyDeclaration",
  "PropertySignature",
  "EnumMember",
  "ClassProperty",
  "ClassPrivateProperty",
  "ClassAccessorProperty",
  "ClassMethod",
  "ClassPrivateMethod",
]);

const CALLABLE_KINDS = new Set(["function", "method", "constructor", "getter", "setter"]);

/** The declaration context threaded through the walk. */
interface DeclContext {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly packageName: string;
  readonly namespace: readonly string[];
  readonly parentId?: string;
  readonly isModuleScope: boolean;
}

/** Per-unit extraction state. */
interface Env {
  readonly config: NodeExtractorConfig;
  readonly input: SymbolExtractionInput;
  readonly unit: CompilationUnit;
  readonly file: string;
  readonly languageId: string;
  readonly compiler: SymbolCompilerMetadata;
  readonly generatedFile: boolean;
  /** Module-level names exported via `export { ... }` clauses. */
  readonly exportedNames: ReadonlySet<string>;
}

interface VariableDeclarator {
  readonly name: string | undefined;
  readonly range: CompilerRange | undefined;
  readonly modifiers: readonly string[];
}

/**
 * Creates a normalized symbol extractor over the compiler layer's syntax
 * trees. All language-specific mapping lives in {@link NodeExtractorConfig};
 * the walk itself is shared.
 */
export function createNodeSymbolExtractor(config: NodeExtractorConfig): SymbolExtractor {
  return createSymbolExtractor({
    metadata: {
      id: config.id,
      languageId: config.languageId,
      displayName: config.displayName,
      version: config.version,
      priority: 0,
      source: "builtin",
    },
    capabilities: config.capabilities ?? {},
    extract: (input) => extractAll(input, config),
  });
}

function extractAll(
  input: SymbolExtractionInput,
  config: NodeExtractorConfig,
): SymbolExtractionOutput {
  const started = nowMs();
  const modules: Symbol[] = [];
  const allSymbols: Symbol[] = [];
  const diagnostics: ReturnType<typeof createSymbolDiagnostic>[] = collectUnitDiagnostics(input);
  const extractedFiles: string[] = [];
  const maxSymbols = input.options?.maxSymbols;

  for (const unit of input.units) {
    if (unit.status !== "ok" || unit.syntaxTree === undefined) continue;
    const { module, symbols, diagnostics: unitDiagnostics } = buildUnit(unit, input, config);
    modules.push(module);
    allSymbols.push(...symbols);
    diagnostics.push(...unitDiagnostics);
    extractedFiles.push(unit.file);
    if (maxSymbols !== undefined && allSymbols.length > maxSymbols) {
      diagnostics.push(
        createSymbolDiagnostic({
          code: "unsupported-construct",
          severity: "info",
          message: `Symbol limit of ${maxSymbols} exceeded in "${unit.file}"; remaining files were skipped.`,
          languageId: config.languageId,
          extractorId: config.id,
          file: unit.file,
        }),
      );
      break;
    }
  }

  const statistics: SymbolExtractionStatistics = Object.freeze({
    files: input.units.length,
    extractedFiles: extractedFiles.length,
    cachedFiles: 0,
    symbolCount: allSymbols.length,
    moduleCount: modules.length,
    diagnosticsCount: diagnostics.length,
    extractTimeMs: nowMs() - started,
  });

  return {
    languageId: config.languageId,
    extractorId: config.id,
    modules,
    symbols: allSymbols,
    relationships: [],
    diagnostics,
    extractedFiles,
    statistics,
  };
}

function collectUnitDiagnostics(
  input: SymbolExtractionInput,
): ReturnType<typeof createSymbolDiagnostic>[] {
  const diagnostics: ReturnType<typeof createSymbolDiagnostic>[] = [];
  for (const unit of input.units) {
    if (unit.status !== "ok" || unit.syntaxTree === undefined) {
      diagnostics.push(
        createSymbolDiagnostic({
          code: "broken-compiler-metadata",
          severity: "info",
          message: `Unit "${unit.file}" has no usable syntax tree (status: ${unit.status}).`,
          languageId: input.languageId,
          extractorId: input.extractorId,
          file: unit.file,
        }),
      );
    }
  }
  return diagnostics;
}

function buildUnit(
  unit: CompilationUnit,
  input: SymbolExtractionInput,
  config: NodeExtractorConfig,
): {
  module: Symbol;
  symbols: readonly Symbol[];
  diagnostics: readonly SymbolDiagnostic[];
} {
  const tree = unit.syntaxTree!;
  const file = unit.file;
  const languageId = input.languageId;
  const moduleName = moduleNameOf(file);
  const packageName = input.fileToPackage[file] ?? input.projectName;
  const compiler: SymbolCompilerMetadata = {
    compilerId: unit.compilerId,
    format: tree.format,
    ...(tree.native?.version !== undefined ? { nativeVersion: tree.native.version } : {}),
  };

  const moduleInfo = collectModuleInfo(tree.root);
  const exportedNames = new Set(moduleInfo.exportedNames);

  const env: Env = {
    config,
    input,
    unit,
    file,
    languageId,
    compiler,
    generatedFile: isGeneratedFile(file),
    exportedNames,
  };

  const ctx: DeclContext = {
    moduleId: moduleSymbolId(languageId, file, moduleName),
    moduleName,
    packageName,
    namespace: [],
    isModuleScope: true,
  };

  const container = buildContainer(tree.root.children ?? [], ctx, env);
  const moduleExports = [
    ...new Set([
      ...moduleInfo.exports,
      ...container.roots.filter((root) => root.exported).map((root) => root.name),
    ]),
  ].sort();
  const moduleInput = makeModuleInput(
    moduleInfo,
    ctx,
    env,
    container.roots.map((root) => root.id),
    moduleExports,
  );
  const { symbols } = buildSymbols([moduleInput, ...container.inputs]);
  const module = symbols[0]!;

  const settings = {
    languageId,
    extractorId: config.id,
    file,
  };
  const diagnostics = detectSymbolDiagnostics(symbols.slice(1), settings);
  return { module, symbols, diagnostics };
}

interface ModuleInfo {
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly reExports: readonly SymbolReExport[];
  /** Names exported through `export { ... }` clauses (local re-exports). */
  readonly exportedNames: readonly string[];
}

function collectModuleInfo(root: SyntaxNode): ModuleInfo {
  const imports: string[] = [];
  const exports: string[] = [];
  const reExports: SymbolReExport[] = [];
  const exportedNames: string[] = [];

  for (const node of root.children ?? []) {
    if (node.kind === "ImportDeclaration" || node.kind === "ImportEqualsDeclaration") {
      if (node.moduleSpecifier !== undefined) imports.push(node.moduleSpecifier);
      continue;
    }
    if (
      node.kind !== "ExportDeclaration" &&
      node.kind !== "ExportNamedDeclaration" &&
      node.kind !== "ExportAllDeclaration"
    ) {
      continue;
    }
    const specifier = node.moduleSpecifier;
    const specifiers = exportSpecifiers(node);
    const exportNames = specifiers.map((spec) => spec.exported).filter((name) => name.length > 0);
    if (specifier === undefined) {
      exports.push(...exportNames);
      exportedNames.push(...specifiers.map((spec) => spec.local).filter((name) => name.length > 0));
      continue;
    }
    if (exportNames.length === 0) {
      reExports.push({ specifier });
    } else {
      reExports.push({ specifier, names: exportNames });
      exports.push(...exportNames);
    }
  }
  return {
    imports: [...new Set(imports)].sort(),
    exports: [...new Set(exports)].sort(),
    reExports,
    exportedNames: [...new Set(exportedNames)],
  };
}

function exportSpecifiers(
  node: SyntaxNode,
): readonly { readonly exported: string; readonly local: string }[] {
  const result: { exported: string; local: string }[] = [];
  for (const child of node.children ?? []) {
    if (child.kind === "NamedExports") {
      for (const specifier of child.children ?? []) {
        if (specifier.kind !== "ExportSpecifier") continue;
        result.push(specifierOf(specifier));
      }
    } else if (child.kind === "ExportSpecifier" || child.kind === "ExportNamespaceSpecifier") {
      result.push(specifierOf(child));
    } else if (child.kind === "NamespaceExport" && child.name !== undefined) {
      result.push({ exported: child.name, local: child.name });
    }
  }
  return result;
}

function specifierOf(node: SyntaxNode): { exported: string; local: string } {
  const exported = node.name ?? "";
  const local = node.propertyName ?? node.name ?? "";
  return { exported, local };
}

function makeModuleInput(
  info: ModuleInfo,
  ctx: DeclContext,
  env: Env,
  childrenIds: readonly string[],
  exports: readonly string[],
): SymbolInput {
  const file = env.file;
  const qualifiedName = joinQualifiedName(ctx.packageName, ctx.moduleName);
  const id = moduleSymbolId(env.languageId, file, ctx.moduleName);
  return {
    kind: "module",
    identifier: ctx.moduleName,
    qualifiedName,
    displayName: ctx.moduleName,
    visibility: "public",
    modifiers: [],
    file,
    languageId: env.languageId,
    packageName: ctx.packageName,
    moduleName: ctx.moduleName,
    compiler: env.compiler,
    parentId: packageSymbolId(env.input.projectName, ctx.packageName),
    childrenIds,
    exported: false,
    id,
    hash: stableHash(env.languageId, file, ctx.moduleName, env.unit.hash),
    exports,
    imports: info.imports,
    reExports: info.reExports,
  };
}

function buildContainer(
  nodes: readonly SyntaxNode[],
  ctx: DeclContext,
  env: Env,
): {
  inputs: readonly SymbolInput[];
  roots: readonly { id: string; name: string; exported: boolean }[];
} {
  interface Entry {
    readonly node: SyntaxNode;
    readonly variableDeclarator?: VariableDeclarator;
    readonly name: string;
    readonly callable: boolean;
    readonly variable: boolean;
  }
  const entries: Entry[] = [];
  for (const raw of nodes) {
    const node = unwrapExport(raw);
    if (node === undefined) continue;
    if (isVariableContainer(node.kind)) {
      for (const declarator of variableDeclarators(node)) {
        entries.push({
          node,
          variableDeclarator: declarator,
          name: declarator.name ?? "",
          callable: false,
          variable: true,
        });
      }
      continue;
    }
    if (!isDeclarable(node.kind)) continue;
    entries.push({
      node,
      name: node.name ?? "",
      callable: CALLABLE_KINDS.has(env.config.kindFor(node.kind)),
      variable: false,
    });
  }

  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.callable) continue;
    counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const inputs: SymbolInput[] = [];
  const roots: { id: string; name: string; exported: boolean }[] = [];
  for (const entry of entries) {
    if (entry.variable) {
      const input = makeVariableInput(entry.variableDeclarator!, ctx, env);
      inputs.push(input);
      roots.push({ id: input.id, name: input.identifier, exported: input.exported ?? false });
      continue;
    }
    let overloadIndex: number | undefined;
    if (entry.callable && (counts.get(entry.name) ?? 0) > 1) {
      overloadIndex = seen.get(entry.name) ?? 0;
      seen.set(entry.name, overloadIndex + 1);
    }
    const built = buildNode(entry.node, ctx, env, overloadIndex);
    inputs.push(...built.inputs);
    const root = built.inputs[built.inputs.length - 1]!;
    roots.push({ id: root.id, name: root.identifier, exported: root.exported ?? false });
  }
  return { inputs, roots };
}

function isVariableContainer(kind: string): boolean {
  return (
    kind === "VariableStatement" || kind === "FirstStatement" || kind === "VariableDeclaration"
  );
}

/**
 * Unwraps `export`/`export default` wrapper nodes (Babel style) to their
 * declaration child so the walk can treat it like a plain declaration with
 * `export`/`default` modifiers already applied by the tree builder.
 */
function unwrapExport(node: SyntaxNode): SyntaxNode | undefined {
  if (node.kind !== "ExportNamedDeclaration" && node.kind !== "ExportDefaultDeclaration") {
    return node;
  }
  return (node.children ?? []).find(
    (child) => isDeclarable(child.kind) || isVariableContainer(child.kind),
  );
}

function variableDeclarators(node: {
  readonly kind: string;
  readonly children?: readonly SyntaxNode[];
  readonly modifiers?: readonly string[];
}): readonly VariableDeclarator[] {
  if (node.kind === "VariableStatement" || node.kind === "FirstStatement") {
    const list = (node.children ?? []).find((child) => child.kind === "VariableDeclarationList");
    const listModifiers = list?.modifiers ?? [];
    return (list?.children ?? [])
      .filter((child) => child.kind === "VariableDeclaration")
      .map((child) => ({
        name: child.name,
        range: child.range,
        modifiers: [...(node.modifiers ?? []), ...listModifiers],
      }));
  }
  return (node.children ?? [])
    .filter((child) => child.kind === "VariableDeclarator")
    .map((child) => ({
      name: child.name,
      range: child.range,
      modifiers: node.modifiers ?? [],
    }));
}

function isDeclarable(kind: string): boolean {
  return DECLARABLE_KINDS.has(kind);
}

function buildNode(
  node: SyntaxNode,
  ctx: DeclContext,
  env: Env,
  overloadIndex?: number,
): { inputs: readonly SymbolInput[]; rootId: string } {
  const kind = env.config.kindFor(node.kind);
  const qualifiedName = qualifiedNameOf(node, ctx, kind);
  const baseId = symbolId(env.languageId, env.file, qualifiedName);
  const rootId = overloadIndex !== undefined ? overloadId(baseId, overloadIndex) : baseId;

  const childCtx: DeclContext = {
    ...ctx,
    parentId: rootId,
    isModuleScope: false,
  };
  const memberNodes = memberNodesOf(node, kind);
  const container = buildContainer(memberNodes, childCtx, env);
  const decorators = decoratorInputs(node, ctx, env, rootId, qualifiedName);
  const childrenIds = [
    ...decorators.map((decorator) => decorator.id),
    ...container.roots.map((root) => root.id),
  ];
  const input = makeInput(node, ctx, env, kind, rootId, qualifiedName, childrenIds, overloadIndex);
  return {
    inputs: [...decorators, ...container.inputs, input],
    rootId,
  };
}

function qualifiedNameOf(node: SyntaxNode, ctx: DeclContext, kind: SymbolKind): string {
  const isDefault = node.modifiers?.includes("default") ?? false;
  const identifier = node.name ?? (isDefault ? "default" : `__anonymous_${kind}`);
  return joinQualifiedName(ctx.packageName, ctx.moduleName, ...ctx.namespace, identifier);
}

function memberNodesOf(node: SyntaxNode, kind: SymbolKind): readonly SyntaxNode[] {
  const children = node.children ?? [];
  switch (kind) {
    case "class":
    case "interface":
      return memberChildren(children);
    case "enum":
      return children.filter((child) => child.kind === "EnumMember");
    case "namespace":
      return children.filter(
        (child) =>
          child.kind === "ModuleDeclaration" ||
          isVariableContainer(child.kind) ||
          isDeclarable(child.kind),
      );
    default:
      return [];
  }
}

/** Class members, unwrapping a Babel-style `ClassBody` indirection. */
function memberChildren(children: readonly SyntaxNode[]): readonly SyntaxNode[] {
  const direct = children.filter((child) => CLASS_MEMBER_KINDS.has(child.kind));
  if (direct.length > 0) return direct;
  const body = children.find((child) => child.kind === "ClassBody");
  return body === undefined
    ? []
    : (body.children?.filter((child) => CLASS_MEMBER_KINDS.has(child.kind)) ?? []);
}

function decoratorInputs(
  node: SyntaxNode,
  ctx: DeclContext,
  env: Env,
  parentId: string,
  parentQualifiedName: string,
): readonly SymbolInput[] {
  return (node.decorators ?? []).map((text, index) => {
    const name = decoratorName(text);
    const identifier = name ?? `__decorator_${index}`;
    return {
      kind: "decorator",
      identifier,
      qualifiedName: `${parentQualifiedName}.${identifier}`,
      displayName: identifier,
      visibility: "public",
      modifiers: [],
      file: env.file,
      languageId: env.languageId,
      packageName: ctx.packageName,
      moduleName: ctx.moduleName,
      ...(ctx.namespace.length > 0 ? { namespace: ctx.namespace } : {}),
      compiler: env.compiler,
      parentId,
      childrenIds: [],
      exported: false,
      synthetic: name === undefined,
      id: `${parentId}@decorator:${index}`,
      hash: stableHash(env.languageId, env.file, parentId, index, identifier),
    };
  });
}

function decoratorName(text: string): string | undefined {
  const word = text.trim().split(/[(\s]/)[0];
  if (word === undefined || word.length === 0) return undefined;
  return word.replace(/[^A-Za-z0-9_.$]/g, "");
}

function makeVariableInput(
  declarator: VariableDeclarator,
  ctx: DeclContext,
  env: Env,
): SymbolInput {
  const identifier = declarator.name ?? "";
  const qualifiedName = joinQualifiedName(
    ctx.packageName,
    ctx.moduleName,
    ...ctx.namespace,
    identifier,
  );
  const exported =
    declarator.modifiers.includes("export") ||
    (ctx.isModuleScope && env.exportedNames.has(identifier));
  const kind =
    declarator.modifiers.includes("const") || declarator.modifiers.includes("using")
      ? "constant"
      : "variable";
  const id = symbolId(env.languageId, env.file, qualifiedName);
  return {
    kind,
    identifier,
    qualifiedName,
    displayName: identifier,
    visibility: "public",
    modifiers: declarator.modifiers,
    file: env.file,
    ...(declarator.range !== undefined ? { range: declarator.range } : {}),
    languageId: env.languageId,
    packageName: ctx.packageName,
    moduleName: ctx.moduleName,
    ...(ctx.namespace.length > 0 ? { namespace: ctx.namespace } : {}),
    compiler: env.compiler,
    parentId: ctx.parentId ?? ctx.moduleId,
    childrenIds: [],
    exported,
    id,
    hash: stableHash(env.languageId, env.file, qualifiedName, kind),
  };
}

function makeInput(
  node: SyntaxNode,
  ctx: DeclContext,
  env: Env,
  kind: SymbolKind,
  rootId: string,
  qualifiedName: string,
  childrenIds: readonly string[],
  overloadIndex?: number,
): SymbolInput {
  const isDefault = node.modifiers?.includes("default") ?? false;
  const identifier = node.name ?? (isDefault ? "default" : "");
  const documentation =
    node.documentation !== undefined
      ? parseDocumentationComment(node.documentation, env.config.docFormat)
      : undefined;
  const attributes: Record<string, string> = {};
  if (node.typeParameters !== undefined && node.typeParameters.length > 0) {
    attributes["typeParameters"] = node.typeParameters.join(", ");
  }
  if (overloadIndex !== undefined) {
    attributes["overloadIndex"] = String(overloadIndex);
  }
  const exported =
    (node.modifiers?.includes("export") ?? false) ||
    (ctx.isModuleScope && env.exportedNames.has(identifier));

  return {
    kind,
    identifier,
    qualifiedName,
    displayName: identifier || `anonymous-${kind}`,
    visibility: visibilityOf(node.modifiers ?? []),
    modifiers: node.modifiers ?? [],
    file: env.file,
    ...(node.range !== undefined ? { range: node.range } : {}),
    languageId: env.languageId,
    packageName: ctx.packageName,
    moduleName: ctx.moduleName,
    ...(ctx.namespace.length > 0 ? { namespace: ctx.namespace } : {}),
    ...(documentation !== undefined ? { documentation } : {}),
    attributes,
    compiler: env.compiler,
    parentId: ctx.parentId ?? ctx.moduleId,
    childrenIds,
    exported,
    internal: documentation !== undefined && hasDocumentationTag(documentation, "internal"),
    generated:
      env.generatedFile ||
      (documentation !== undefined && hasDocumentationTag(documentation, "generated")),
    deprecated: documentation !== undefined && hasDocumentationTag(documentation, "deprecated"),
    synthetic: identifier.length === 0,
    id: rootId,
    hash: stableHash(env.languageId, env.file, qualifiedName, kind, overloadIndex ?? 0),
    ...payloadOf(node, kind, env.config),
  };
}

function visibilityOf(modifiers: readonly string[]): "public" | "protected" | "private" {
  if (modifiers.includes("private")) return "private";
  if (modifiers.includes("protected")) return "protected";
  return "public";
}

function payloadOf(
  node: SyntaxNode,
  kind: SymbolKind,
  config: NodeExtractorConfig,
): Partial<SymbolInput> {
  switch (kind) {
    case "class":
    case "interface": {
      const heritage = heritageOf(node);
      return heritage.length > 0 ? { heritage } : {};
    }
    case "type-alias": {
      const typeName = typeNameOf(node);
      return typeName !== undefined ? { typeName } : {};
    }
    case "enum": {
      const members = (node.children ?? [])
        .filter((child) => child.kind === "EnumMember")
        .map((child) => child.name)
        .filter((name): name is string => name !== undefined);
      return members.length > 0 ? { enumMembers: members } : {};
    }
    default:
      break;
  }
  if (CALLABLE_KINDS.has(kind)) {
    const parameters = (node.children ?? []).filter(
      (child) => config.kindFor(child.kind) === "parameter",
    );
    const names = parameters
      .map((parameter) => parameter.name ?? "")
      .filter((name) => name.length > 0);
    return {
      parameterCount: names.length,
      signatures: [`(${names.join(", ")})`],
    };
  }
  return {};
}

function heritageOf(node: SyntaxNode): readonly string[] {
  const names: string[] = [];
  for (const child of node.children ?? []) {
    if (child.kind === "HeritageClause") {
      for (const sub of child.children ?? []) {
        const name = nodeName(sub);
        if (name !== undefined) names.push(name);
      }
    } else if (child.kind === "ClassImplements" || child.kind === "Identifier") {
      const name = child.name;
      if (name !== undefined) names.push(name);
    }
  }
  return [...new Set(names)];
}

function typeNameOf(node: SyntaxNode): string | undefined {
  for (const child of node.children ?? []) {
    if (child.kind === "TypeReference" || child.kind === "TypeLiteral") {
      const name = nodeName(child);
      if (name !== undefined) return name;
    }
  }
  return undefined;
}

function nodeName(node: SyntaxNode): string | undefined {
  if (node.name !== undefined) return node.name;
  return node.children?.[0]?.name;
}

function isGeneratedFile(file: string): boolean {
  return file.endsWith(".d.ts") || file.endsWith(".d.mts") || file.endsWith(".d.cts");
}
