import type { CompilerRange, SyntaxNode, SyntaxTree } from "../../results/index.js";
import { createSyntaxTree } from "../../models/syntax.js";
import type { TreeLimits } from "../../shared/tree.js";

interface BabelNode {
  readonly type: string;
  readonly start?: number | null;
  readonly end?: number | null;
  readonly loc?: {
    readonly start?: { readonly line?: number; readonly column?: number } | null;
    readonly end?: { readonly line?: number; readonly column?: number } | null;
  } | null;
  readonly name?: unknown;
  readonly id?: unknown;
  readonly static?: unknown;
  readonly async?: unknown;
  readonly generator?: unknown;
  readonly computed?: unknown;
  readonly kind?: unknown;
  readonly source?: { readonly value?: unknown };
  readonly leadingComments?: readonly { readonly type?: unknown; readonly value?: unknown }[];
  readonly decorators?: readonly {
    readonly expression?: {
      readonly type?: unknown;
      readonly name?: unknown;
      readonly callee?: {
        readonly type?: unknown;
        readonly name?: unknown;
        readonly object?: { readonly name?: unknown; readonly type?: unknown };
        readonly property?: { readonly name?: unknown; readonly type?: unknown };
      };
    };
  }[];
  readonly [key: string]: unknown;
}

interface BabelEntry {
  readonly node: BabelNode;
  readonly exported?: boolean;
  readonly defaultExport?: boolean;
}

/** A parsed Babel file. */
export interface BabelFileNode {
  readonly type: "File";
  readonly program: BabelNode;
  readonly errors: readonly unknown[];
  readonly comments?: readonly unknown[];
}

/** The Babel parser API surface the tree builder needs. */
export interface BabelParser {
  parse(code: string, options?: unknown): BabelFileNode;
}

const CHILD_KEYS = new Set([
  "program",
  "body",
  "declarations",
  "declaration",
  "init",
  "id",
  "expression",
  "callee",
  "arguments",
  "consequent",
  "alternate",
  "test",
  "left",
  "right",
  "properties",
  "elements",
  "block",
  "superClass",
  "params",
  "object",
  "property",
  "source",
  "specifiers",
  "argument",
  "key",
  "value",
]);

/**
 * Builds a normalized {@link SyntaxTree} from a Babel AST.
 *
 * Only structural nodes are kept, enriched with modifiers, documentation
 * comments and decorators; the native AST remains reachable only as an opaque
 * handle on the tree root. The walk is bounded by `TreeLimits`.
 */
export function buildBabelTree(file: BabelFileNode, limits: TreeLimits): SyntaxTree {
  const state = { count: 0 };
  const walkedRoot = walk(file.program, 0, limits, state);
  const root: SyntaxNode = Object.freeze({
    ...walkedRoot,
    ...(file.program.start !== undefined && file.program.start !== null
      ? { raw: file.program }
      : {}),
  });
  return createSyntaxTree({
    languageId: "javascript",
    file: "",
    format: "ecmascript",
    root,
    native: { name: "@babel/parser" },
  });
}

function walk(
  node: BabelNode,
  depth: number,
  limits: TreeLimits,
  state: { count: number },
  context?: { exported?: boolean; defaultExport?: boolean },
): SyntaxNode {
  state.count += 1;
  const children: SyntaxNode[] = [];
  if (depth < limits.maxDepth && state.count < limits.maxNodes) {
    for (const entry of childEntries(node)) {
      const result = walk(entry.node, depth + 1, limits, state, entry);
      if (state.count <= limits.maxNodes) children.push(result);
    }
  }
  const name = nameOf(node);
  const range = rangeOf(node);
  const modifiers = modifiersOf(node, context);
  const documentation = documentationOf(node);
  const decorators = decoratorsOf(node);
  const moduleSpecifier = moduleSpecifierOf(node);
  const propertyName = propertyNameOf(node);
  return Object.freeze({
    kind: node.type,
    ...(name !== undefined ? { name } : {}),
    ...(range !== undefined ? { range } : {}),
    ...(children.length > 0 ? { children: Object.freeze(children) } : {}),
    ...(modifiers.length > 0 ? { modifiers: Object.freeze(modifiers) } : {}),
    ...(documentation !== undefined ? { documentation } : {}),
    ...(decorators.length > 0 ? { decorators: Object.freeze(decorators) } : {}),
    ...(moduleSpecifier !== undefined ? { moduleSpecifier } : {}),
    ...(propertyName !== undefined ? { propertyName } : {}),
  });
}

function childEntries(node: BabelNode): BabelEntry[] {
  const isExport =
    node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration";
  const entries: BabelEntry[] = [];
  for (const key of CHILD_KEYS) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) entries.push(entryFor(item, isExport, key, node.type));
      }
    } else if (isNode(value)) {
      entries.push(entryFor(value, isExport, key, node.type));
    }
  }
  return entries;
}

function entryFor(
  node: BabelNode,
  isExport: boolean,
  key: string,
  wrapperType: string,
): BabelEntry {
  if (!isExport || key !== "declaration") return { node };
  return {
    node,
    exported: true,
    defaultExport: wrapperType === "ExportDefaultDeclaration",
  };
}

function isNode(value: unknown): value is BabelNode {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function nameOf(node: BabelNode): string | undefined {
  const id = node.id;
  if (isNode(id) && typeof id.name === "string") return id.name;
  if (typeof node.name === "string") return node.name;
  if (
    node.type === "ClassProperty" ||
    node.type === "ClassPrivateProperty" ||
    node.type === "ClassAccessorProperty" ||
    node.type === "ClassMethod" ||
    node.type === "ClassPrivateMethod" ||
    node.type === "ObjectMethod" ||
    node.type === "ObjectProperty"
  ) {
    const key = node["key"];
    if (isNode(key) && typeof key.name === "string") return key.name;
  }
  if (node.type === "ExportSpecifier" || node.type === "ExportNamespaceSpecifier") {
    const exported = node["exported"];
    if (isNode(exported) && typeof exported.name === "string") return exported.name;
  }
  if (
    node.type === "ImportSpecifier" ||
    node.type === "ImportDefaultSpecifier" ||
    node.type === "ImportNamespaceSpecifier"
  ) {
    const local = node["local"];
    if (isNode(local) && typeof local.name === "string") return local.name;
  }
  return undefined;
}

function propertyNameOf(node: BabelNode): string | undefined {
  if (node.type === "ExportSpecifier" || node.type === "ImportSpecifier") {
    const local = node["local"];
    if (isNode(local) && typeof local.name === "string") return local.name;
  }
  return undefined;
}

function rangeOf(node: BabelNode): CompilerRange | undefined {
  const start = node.loc?.start;
  const end = node.loc?.end;
  if (start?.line === undefined || start.column === undefined) return undefined;
  if (end?.line === undefined || end.column === undefined) return undefined;
  return Object.freeze({
    start: Object.freeze({
      line: start.line,
      column: start.column + 1,
      ...(node.start !== undefined && node.start !== null ? { offset: node.start } : {}),
    }),
    end: Object.freeze({
      line: end.line,
      column: end.column + 1,
      ...(node.end !== undefined && node.end !== null ? { offset: node.end } : {}),
    }),
  });
}

function modifiersOf(
  node: BabelNode,
  context?: { exported?: boolean; defaultExport?: boolean },
): readonly string[] {
  const modifiers: string[] = [];
  if (node.static === true) modifiers.push("static");
  if (node.async === true) modifiers.push("async");
  if (node.generator === true) modifiers.push("generator");
  if (node.computed === true) modifiers.push("computed");
  if (node.type === "VariableDeclaration" && typeof node.kind === "string") {
    modifiers.push(node.kind);
  }
  if (context?.exported === true) modifiers.push("export");
  if (context?.defaultExport === true) modifiers.push("default");
  return modifiers;
}

function documentationOf(node: BabelNode): string | undefined {
  const comments = node.leadingComments;
  if (!Array.isArray(comments) || comments.length === 0) return undefined;
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index]!;
    if (comment.type !== "CommentBlock") continue;
    if (typeof comment.value !== "string") continue;
    const text = `/**${comment.value}*/`.trim();
    if (text.length > 0) return text;
  }
  return undefined;
}

function decoratorsOf(node: BabelNode): readonly string[] {
  const decorators = node.decorators;
  if (!Array.isArray(decorators) || decorators.length === 0) return [];
  const texts: string[] = [];
  for (const decorator of decorators) {
    const expression = decorator.expression;
    if (expression === undefined) continue;
    const text = expressionTextOf(expression);
    if (text !== undefined) texts.push(text);
  }
  return texts;
}

function expressionTextOf(expression: {
  readonly type?: unknown;
  readonly name?: unknown;
  readonly callee?: {
    readonly type?: unknown;
    readonly name?: unknown;
    readonly object?: { readonly name?: unknown; readonly type?: unknown };
    readonly property?: { readonly name?: unknown; readonly type?: unknown };
  };
}): string | undefined {
  if (expression.type === "Identifier" && typeof expression.name === "string") {
    return expression.name;
  }
  if (expression.type === "CallExpression" && expression.callee !== undefined) {
    const callee = expressionTextOf(expression.callee);
    return callee === undefined ? "CallExpression" : `${callee}()`;
  }
  if (expression.type === "MemberExpression" && expression.callee !== undefined) {
    const object = expression.callee.object;
    const property = expression.callee.property;
    if (typeof object?.name === "string" && typeof property?.name === "string") {
      return `${object.name}.${property.name}`;
    }
  }
  return typeof expression.type === "string" ? expression.type : undefined;
}

function moduleSpecifierOf(node: BabelNode): string | undefined {
  const value = node.source?.value;
  return typeof value === "string" ? value : undefined;
}
