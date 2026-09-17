import type { SyntaxNode, SyntaxTree } from "../results/index.js";

/** Input required to build a {@link SyntaxTree}. */
export interface SyntaxTreeInput {
  readonly languageId: string;
  readonly file: string;
  readonly format: string;
  readonly root: SyntaxNode;
  readonly native?: { readonly name: string; readonly version?: string };
}

function countNodes(node: SyntaxNode): number {
  let count = 1;
  for (const child of node.children ?? []) count += countNodes(child);
  return count;
}

function freezeNode(node: SyntaxNode): SyntaxNode {
  return Object.freeze({
    kind: node.kind,
    ...(node.name !== undefined ? { name: node.name } : {}),
    ...(node.range !== undefined ? { range: node.range } : {}),
    ...(node.children !== undefined
      ? { children: Object.freeze(node.children.map(freezeNode)) }
      : {}),
    ...(node.raw !== undefined ? { raw: node.raw } : {}),
    ...(node.modifiers !== undefined ? { modifiers: Object.freeze([...node.modifiers]) } : {}),
    ...(node.documentation !== undefined ? { documentation: node.documentation } : {}),
    ...(node.decorators !== undefined ? { decorators: Object.freeze([...node.decorators]) } : {}),
    ...(node.typeParameters !== undefined
      ? { typeParameters: Object.freeze([...node.typeParameters]) }
      : {}),
    ...(node.moduleSpecifier !== undefined ? { moduleSpecifier: node.moduleSpecifier } : {}),
    ...(node.propertyName !== undefined ? { propertyName: node.propertyName } : {}),
  });
}

/** Builds an immutable {@link SyntaxTree}, computing node count. */
export function createSyntaxTree(input: SyntaxTreeInput): SyntaxTree {
  const root = freezeNode(input.root);
  const nodeCount = countNodes(root);
  return Object.freeze({
    languageId: input.languageId,
    file: input.file,
    format: input.format,
    root,
    nodeCount,
    truncated: nodeCount >= NODE_CAP_FALLBACK,
    ...(input.native !== undefined
      ? {
          native: Object.freeze({
            name: input.native.name,
            ...(input.native.version !== undefined ? { version: input.native.version } : {}),
          }),
        }
      : {}),
  });
}

/** Fallback cap used only for the truncation flag (see request caps). */
export const NODE_CAP_FALLBACK = 100_000;
