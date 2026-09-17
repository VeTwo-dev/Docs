import type * as ts from "typescript";
import type { CompilerRange, SyntaxNode, SyntaxTree } from "../../results/index.js";
import { createSyntaxTree } from "../../models/syntax.js";
import type { TreeLimits } from "../../shared/tree.js";
import type { TypeScriptModule } from "./native.js";

/** The `SyntaxKind` enum value for `MultiLineCommentTrivia` (`/**`). */
const MULTI_LINE_COMMENT = 3;

/**
 * Corrects `SyntaxKind` enum-name collisions. In some TypeScript versions the
 * `VariableStatement` value aliases the `FirstStatement` range marker, and the
 * enum's reverse map yields the marker name; keep the real node name instead.
 */
const KIND_NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  FirstStatement: "VariableStatement",
});

interface ModifierLike {
  readonly kind: number;
}

interface DecoratedNode {
  readonly modifiers?: readonly ModifierLike[] | undefined;
}

interface TypedNode {
  readonly typeParameters?: readonly { readonly name?: { readonly text?: string } }[] | undefined;
}

interface SpecifiedNode {
  readonly moduleSpecifier?: ts.Node | undefined;
}

interface VariableList {
  readonly flags?: number | undefined;
}

interface SourceCarrier {
  readonly text: string;
}

/**
 * Builds a normalized {@link SyntaxTree} from a TypeScript {@link ts.SourceFile}.
 *
 * Tokens (keywords, punctuation) are dropped; statements, declarations and
 * named nodes are kept with their names, ranges and structural metadata
 * (modifiers, decorators, documentation comments, generics, module
 * specifiers). The walk is bounded by `TreeLimits` so pathological files stay
 * memory-efficient.
 */
export function buildTypeScriptTree(
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
  limits: TreeLimits,
): SyntaxTree {
  const state = { count: 0 };
  const root = walk(sourceFile, sourceFile, ts, 0, limits, state);
  return createSyntaxTree({
    languageId: "typescript",
    file: sourceFile.fileName,
    format: sourceFile.fileName.endsWith(".tsx") ? "tsx" : "typescript",
    root,
    native: { name: "typescript", version: ts.version },
  });
}

function walk(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
  depth: number,
  limits: TreeLimits,
  state: { count: number },
): SyntaxNode {
  state.count += 1;
  const children: SyntaxNode[] = [];
  if (depth < limits.maxDepth && state.count < limits.maxNodes) {
    ts.forEachChild(node, (child) => {
      if (isDroppedToken(child.kind, ts)) return;
      const result = walk(child, sourceFile, ts, depth + 1, limits, state);
      if (state.count <= limits.maxNodes) children.push(result);
    });
  }
  const name = nameOf(node, sourceFile, ts);
  const range = rangeOf(node, sourceFile);
  const modifiers = modifiersOf(node, ts);
  const decorators = decoratorsOf(node, sourceFile, ts);
  const documentation = documentationOf(node, sourceFile, ts, name);
  const typeParameters = typeParametersOf(node);
  const moduleSpecifier = moduleSpecifierOf(node, ts);
  const propertyName = propertyNameOf(node);
  const kindName =
    KIND_NAME_ALIASES[ts.SyntaxKind[node.kind] ?? "Unknown"] ??
    ts.SyntaxKind[node.kind] ??
    "Unknown";
  return Object.freeze({
    kind: kindName,
    ...(name !== undefined ? { name } : {}),
    ...(range !== undefined ? { range } : {}),
    ...(children.length > 0 ? { children: Object.freeze(children) } : {}),
    ...(modifiers.length > 0 ? { modifiers: Object.freeze(modifiers) } : {}),
    ...(documentation !== undefined ? { documentation } : {}),
    ...(decorators.length > 0 ? { decorators: Object.freeze(decorators) } : {}),
    ...(typeParameters.length > 0 ? { typeParameters: Object.freeze(typeParameters) } : {}),
    ...(moduleSpecifier !== undefined ? { moduleSpecifier } : {}),
    ...(propertyName !== undefined ? { propertyName } : {}),
  });
}

function nameOf(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
): string | undefined {
  const name = (node as { name?: { text?: unknown } }).name;
  if (typeof name?.text === "string") return name.text;
  if (ts.SyntaxKind[node.kind] === "ExpressionWithTypeArguments") {
    const expression = (node as { expression?: ts.Node }).expression;
    if (expression !== undefined) {
      try {
        const text = expression.getText(sourceFile).trim();
        if (text.length > 0) return text;
      } catch {
        // Ignore nodes whose expression cannot be read.
      }
    }
  }
  return undefined;
}

/**
 * Returns whether a child node should be dropped from the tree. Keyword and
 * punctuation tokens are dropped; named nodes (`Identifier`, `Parameter`,
 * `EnumMember`, ...) are kept so structural extraction can rely on them.
 * `ts.isTokenKind` is avoided because in some TypeScript versions its token
 * range overlaps `Identifier`.
 */
function isDroppedToken(kind: number, ts: TypeScriptModule): boolean {
  const name = ts.SyntaxKind[kind] ?? "";
  return name.endsWith("Token") || name.endsWith("Keyword");
}

function rangeOf(node: ts.Node, sourceFile: ts.SourceFile): CompilerRange | undefined {
  try {
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    const startPos = sourceFile.getLineAndCharacterOfPosition(start);
    const endPos = sourceFile.getLineAndCharacterOfPosition(end);
    return Object.freeze({
      start: Object.freeze({
        line: startPos.line + 1,
        column: startPos.character + 1,
        offset: start,
      }),
      end: Object.freeze({ line: endPos.line + 1, column: endPos.character + 1, offset: end }),
    });
  } catch {
    return undefined;
  }
}

function modifiersOf(node: ts.Node, ts: TypeScriptModule): readonly string[] {
  const modifiers: string[] = [];
  const decorated = node as DecoratedNode;
  for (const candidate of decorated.modifiers ?? []) {
    if (ts.isDecorator(candidate as ts.Node) || ts.isModifier(candidate as ts.Node)) {
      if (ts.isDecorator(candidate as ts.Node)) continue;
      const text = modifierText(candidate.kind, ts);
      if (text !== undefined && !modifiers.includes(text)) modifiers.push(text);
    }
  }
  const keyword = variableKeyword(node, ts);
  if (keyword !== undefined && !modifiers.includes(keyword)) modifiers.push(keyword);
  return modifiers;
}

function modifierText(kind: number, ts: TypeScriptModule): string | undefined {
  const name = ts.SyntaxKind[kind] ?? "";
  if (!name.endsWith("Keyword")) return undefined;
  return name.slice(0, -"Keyword".length).toLowerCase();
}

function variableKeyword(node: ts.Node, ts: TypeScriptModule): string | undefined {
  if (!ts.isVariableDeclarationList(node)) return undefined;
  const flags = (node as VariableList).flags ?? 0;
  if ((flags & ts.NodeFlags.Const) !== 0) return "const";
  if ((flags & ts.NodeFlags.Let) !== 0) return "let";
  if ((flags & ts.NodeFlags.Using) !== 0) return "using";
  return "var";
}

function decoratorsOf(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
): readonly string[] {
  const decorated = node as DecoratedNode;
  if (decorated.modifiers === undefined) return [];
  const decorators: string[] = [];
  for (const candidate of decorated.modifiers) {
    if (!ts.isDecorator(candidate as ts.Node)) continue;
    const expression = (candidate as { expression?: ts.Node }).expression;
    if (expression === undefined) continue;
    try {
      decorators.push(
        sourceFile.text.slice(expression.getStart(sourceFile), expression.getEnd()).trim(),
      );
    } catch {
      // Ignore decorators whose expression cannot be sliced.
    }
  }
  return decorators;
}

function documentationOf(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
  name: string | undefined,
): string | undefined {
  const wantsDocumentation = name !== undefined || (node as DecoratedNode).modifiers !== undefined;
  if (!wantsDocumentation) return undefined;
  try {
    const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
    if (ranges === undefined) return undefined;
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const comment = ranges[index]!;
      if (comment.kind !== MULTI_LINE_COMMENT) continue;
      const text = (sourceFile as unknown as SourceCarrier).text.slice(comment.pos, comment.end);
      if (!text.startsWith("/**")) continue;
      const trimmed = text.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  } catch {
    // Ignore nodes whose trivia cannot be inspected.
  }
  return undefined;
}

function typeParametersOf(node: ts.Node): readonly string[] {
  const typed = node as TypedNode;
  if (typed.typeParameters === undefined) return [];
  const names: string[] = [];
  for (const parameter of typed.typeParameters) {
    const name = parameter.name?.text;
    if (typeof name === "string" && name.length > 0) names.push(name);
  }
  return names;
}

function moduleSpecifierOf(node: ts.Node, ts: TypeScriptModule): string | undefined {
  const specified = (node as SpecifiedNode).moduleSpecifier;
  if (specified !== undefined && ts.isStringLiteral(specified)) return specified.text;
  if (ts.SyntaxKind[node.kind] === "ImportEqualsDeclaration") {
    const reference = (node as { moduleReference?: ts.Node }).moduleReference;
    if (reference === undefined || !ts.isExternalModuleReference(reference)) return undefined;
    const expression = (reference as { expression?: ts.Node }).expression;
    if (expression !== undefined && ts.isStringLiteral(expression)) return expression.text;
  }
  return undefined;
}

function propertyNameOf(node: ts.Node): string | undefined {
  const property = (node as { propertyName?: { text?: unknown } }).propertyName;
  if (property === undefined || !("text" in property)) return undefined;
  const text = (property as { text?: unknown }).text;
  return typeof text === "string" && text.length > 0 ? text : undefined;
}
