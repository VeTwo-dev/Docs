/**
 * MDX Parser (Safe Mode).
 *
 * Parses MDX into authored documents without executing any code.
 * JSX elements become `custom` IR blocks carrying data-only props;
 * expressions are captured as opaque strings, never evaluated.
 *
 *   MDX → Parser → MDX AST → Documentation IR → Renderer
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Content, Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";

import { parseFrontmatter, extractLocks, fingerprintOf, mdastToBlock } from "./markdown.js";
import type { AuthoredDocument, ComponentUsage, DocumentationContentOwnership } from "../types.js";
import type { IRBlock } from "../../documentation/compiler/ir.js";
import type { DocumentationComponentRegistry } from "../components/registry.js";
import { diagnostic } from "../../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../../documentation/compiler/diagnostics.js";

/** Result of parsing an MDX document. */
export interface MdxParseResult {
  readonly document: AuthoredDocument;
  /** Diagnostics for unknown components / invalid props. */
  readonly diagnostics: readonly DocumentationDiagnostic[];
}

/** Attribute value extracted from JSX (data-only). */
type JsxAttrValue = string | number | boolean | undefined;

/**
 * Parse MDX content safely (no execution).
 *
 * @param registry - when provided, component usages are validated against it
 */
export function parseMdx(
  path: string,
  slug: string,
  raw: string,
  options: {
    gfm?: boolean;
    ownership?: DocumentationContentOwnership;
    registry?: DocumentationComponentRegistry;
  } = {},
): MdxParseResult {
  const diagnostics: DocumentationDiagnostic[] = [];
  const { data: frontmatter, body } = parseFrontmatter(raw);
  const locks = extractLocks(raw);

  const processor = unified().use(remarkParse).use(remarkMdx);
  if (options.gfm !== false) processor.use(remarkGfm);

  const tree = processor.parse(body) as Root;

  const usages: ComponentUsage[] = [];
  const mutableBlocks: {
    index: number;
    block: IRBlock;
    ownership: DocumentationContentOwnership;
  }[] = [];
  let index = 0;
  const blocks = mutableBlocks;

  const visitNode = (node: Content): void => {
    const block = mdastToBlock(node);
    if (block !== undefined) {
      mutableBlocks.push({
        index: index++,
        block,
        ownership: options.ownership ?? "user-authored",
      });
    }
  };

  for (const child of tree.children) {
    if (child.type === "mdxJsxFlowElement") {
      const element = child as MdxJsxFlowElement;
      const name = elementName(element);
      const block = jsxToCustomBlock(name, element);
      mutableBlocks.push({
        index: index++,
        block,
        ownership: options.ownership ?? "user-authored",
      });
      usages.push(usageOf(name, element));
      continue;
    }
    // Text-level JSX inside paragraphs is flattened to its text content.
    if (child.type === "paragraph") {
      const hasJsx = (child.children ?? []).some(
        (c) => c.type === "mdxJsxTextElement" || c.type === "mdxTextExpression",
      );
      if (hasJsx) {
        for (const inner of child.children) {
          if (inner.type === "mdxJsxTextElement") {
            const el = inner as MdxJsxTextElement;
            const name = el.name ?? "Unknown";
            mutableBlocks.push({
              index: index++,
              block: jsxToCustomBlock(name, el),
              ownership: options.ownership ?? "user-authored",
            });
            usages.push(usageOf(name, el));
          } else if (inner.type === "mdxTextExpression") {
            // Expression containers are data-opaque in safe mode.
            mutableBlocks.push({
              index: index++,
              block: {
                kind: "custom",
                component: "Expression",
                props: { value: String(inner.value ?? "").trim() },
              },
              ownership: options.ownership ?? "user-authored",
            });
          } else {
            visitNode(inner as Content);
          }
        }
        continue;
      }
    }
    visitNode(child);
  }

  // Validate component usages against the registry.
  if (options.registry !== undefined) {
    validateUsages(usages, options.registry, path, diagnostics);
  }

  return {
    document: {
      path,
      slug,
      frontmatter,
      blocks,
      locks,
      provenance: {
        source: "user",
        sourceReferences: [],
        fingerprint: fingerprintOf(blocks.map((b) => b.block)),
      },
      componentUsages: usages,
    },
    diagnostics,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────

function validateUsages(
  usages: readonly ComponentUsage[],
  registry: DocumentationComponentRegistry,
  path: string,
  diagnostics: DocumentationDiagnostic[],
): void {
  for (const usage of usages) {
    const registered = registry.resolve(usage.name);
    if (registered === undefined) {
      diagnostics.push(
        diagnostic(
          "DOC_UNKNOWN_COMPONENT",
          "error",
          `Component <${usage.name}> is not registered.`,
          path,
          `Register it via components configuration or use one of: ${
            registry
              .list()
              .map((c) => c.name)
              .join(", ") || "(none)"
          }.`,
        ),
      );
      continue;
    }
    // Required props check on raw props text (safe — no evaluation).
    const props = registered.props ?? {};
    for (const [propName, propSpec] of Object.entries(props)) {
      if (propSpec.required === true && !usesProp(usage.propsText, propName)) {
        diagnostics.push(
          diagnostic(
            "DOC_MISSING_REQUIRED_PROP",
            "error",
            `<${usage.name}> is missing required prop "${propName}".`,
            path,
          ),
        );
      }
    }
  }
}

function usesProp(propsText: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*=`).test(propsText);
}

// ─── JSX helpers ─────────────────────────────────────────────────────────

function elementName(element: MdxJsxFlowElement | MdxJsxTextElement): string {
  return element.name ?? "Unknown";
}

/** Extract data-only attribute values; expressions become opaque strings. */
export function extractAttributes(
  element: MdxJsxFlowElement | MdxJsxTextElement,
): Record<string, JsxAttrValue> {
  const attrs: Record<string, JsxAttrValue> = {};
  for (const attr of element.attributes) {
    if (attr.type !== "mdxJsxAttribute") continue;
    const value = attr.value;
    if (value === undefined) {
      attrs[attr.name] = true;
    } else if (typeof value === "string") {
      attrs[attr.name] = unquote(value);
    } else if (typeof value === "object" && value !== null && "value" in value) {
      // mdxJsxAttributeValueExpression — keep raw text, never evaluate.
      attrs[attr.name] = `{${String(value.value ?? "").trim()}}`;
    }
  }
  return attrs;
}

function jsxToCustomBlock(name: string, element: MdxJsxFlowElement | MdxJsxTextElement): IRBlock {
  const props = extractAttributes(element) as Record<string, unknown>;
  const children = element.children ?? [];
  const text = mdastToString({ type: "root", children } as never).trim();

  // Elements that are pure text wrappers stay readable.
  if (
    Object.keys(props).length === 0 &&
    text.length > 0 &&
    children.every((c) => !String(c.type).startsWith("mdxJsx"))
  ) {
    return {
      kind: "custom",
      component: name,
      props: { children: text },
    };
  }
  if (text.length > 0) {
    return { kind: "custom", component: name, props: { ...props, children: text } };
  }
  return { kind: "custom", component: name, props };
}

function usageOf(name: string, element: MdxJsxFlowElement | MdxJsxTextElement): ComponentUsage {
  const raw = (element.attributes ?? [])
    .map((attr) =>
      attr.type === "mdxJsxAttribute"
        ? typeof attr.value === "string"
          ? `${attr.name}="${attr.value}"`
          : `${attr.name}=…`
        : "",
    )
    .filter(Boolean)
    .join(" ");
  return {
    name,
    propsText: raw,
    hasChildren: (element.children ?? []).length > 0,
    line: element.position?.start.line ?? 0,
  };
}

function unquote(text: string): string {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}
