/**
 * API Page Generator.
 *
 * Transforms semantic API symbols into rich IR pages with custom blocks
 * for signatures, parameter tables, type displays, heritage chains,
 * and code examples. Replaces the thin "Covered APIs" bullet list in
 * the documentation compiler with per-symbol documentation sections.
 */

import type { IRBlock, IRPage } from "../documentation/compiler/ir.js";
import type { DocumentationArchitecture, DocumentationPageDefinition } from "../documentation/compiler/types.js";
import type { ApiSymbol } from "./models.js";
import type { ApiGraph } from "./graph.js";
import { hashString } from "../utils/hash.js";

/** Options for API page generation. */
export interface ApiPageGeneratorOptions {
  /** Whether to generate per-symbol anchor links. */
  readonly includeAnchors?: boolean;
  /** Whether to include source file links. */
  readonly includeSourceLinks?: boolean;
  /** Whether to include inheritance diagrams. */
  readonly includeInheritance?: boolean;
  /** Maximum members to show before truncation. */
  readonly maxMembers?: number;
  /** Base path for source file links. */
  readonly sourceLinkBase?: string;
}

/**
 * Generate rich IR pages for API symbols.
 *
 * @param architecture - The documentation architecture.
 * @param symbols - All API symbols from the semantic analyzer.
 * @param graph - The API relationship graph.
 * @param options - Generation options.
 * @returns IR pages with rich API content blocks.
 */
export function generateApiPages(
  architecture: DocumentationArchitecture,
  symbols: readonly ApiSymbol[],
  graph: ApiGraph,
  options: ApiPageGeneratorOptions = {},
): IRPage[] {
  const maxMembers = options.maxMembers ?? 50;
  const includeAnchors = options.includeAnchors ?? true;

  // Find API pages from the architecture
  const apiPages = architecture.pages.filter(
    (p) => p.kinds.includes("api") || p.kinds.includes("reference"),
  );

  // Map symbol names to their full ApiSymbol objects
  const symbolsByName = new Map<string, ApiSymbol>();
  for (const sym of symbols) {
    symbolsByName.set(sym.name, sym);
    symbolsByName.set(sym.qualifiedName, sym);
  }

  return apiPages.map((pageDef) => {
    const pageSymbols = pageDef.symbols
      .map((name) => symbolsByName.get(name))
      .filter((s): s is ApiSymbol => s !== undefined);

    const blocks = generatePageBlocks(pageDef, pageSymbols, graph, {
      ...options,
      includeAnchors,
      maxMembers,
    });

    return {
      slug: pageDef.slug,
      title: pageDef.title,
      sectionId: pageDef.sectionId,
      description: pageDef.summary,
      blocks,
      examples: [],
      claims: [],
      references: [],
      fingerprint: hashString(JSON.stringify({ slug: pageDef.slug, symbols: pageDef.symbols })),
      provenance: "compiler" as const,
    };
  });
}

/** Generate IR blocks for a single API page. */
function generatePageBlocks(
  page: DocumentationPageDefinition,
  symbols: readonly ApiSymbol[],
  graph: ApiGraph,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  // Title/summary live in IR page metadata (rendered once per renderer).
  const blocks: IRBlock[] = [];

  // Group symbols by kind for organized display
  const byKind = groupByKind(symbols);

  // Functions
  const fns = byKind["function"];
  if (fns !== undefined && fns.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Functions" });
    for (const sym of fns) {
      blocks.push(...generateFunctionBlocks(sym, graph, options));
    }
  }

  // Classes
  const classes = byKind["class"];
  if (classes !== undefined && classes.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Classes" });
    for (const sym of classes) {
      blocks.push(...generateClassBlocks(sym, graph, options));
    }
  }

  // Interfaces
  const ifaces = byKind["interface"];
  if (ifaces !== undefined && ifaces.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Interfaces" });
    for (const sym of ifaces) {
      blocks.push(...generateInterfaceBlocks(sym, graph, options));
    }
  }

  // Type Aliases
  const typeAliases = byKind["type-alias"];
  if (typeAliases !== undefined && typeAliases.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Types" });
    for (const sym of typeAliases) {
      blocks.push(...generateTypeAliasBlocks(sym, options));
    }
  }

  // Enums
  const enums = byKind["enum"];
  if (enums !== undefined && enums.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Enums" });
    for (const sym of enums) {
      blocks.push(...generateEnumBlocks(sym, options));
    }
  }

  // Variables & Constants
  const vars = [...(byKind["variable"] ?? []), ...(byKind["constant"] ?? [])];
  if (vars.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Constants" });
    for (const sym of vars) {
      blocks.push(...generateVariableBlocks(sym, options));
    }
  }

  return blocks;
}

/** Group symbols by their kind. */
function groupByKind(symbols: readonly ApiSymbol[]): Record<string, ApiSymbol[]> {
  const groups: Record<string, ApiSymbol[]> = {};
  for (const sym of symbols) {
    (groups[sym.kind] ??= []).push(sym);
  }
  return groups;
}

/** Generate blocks for a function symbol. */
function generateFunctionBlocks(
  sym: ApiSymbol,
  _graph: ApiGraph,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  // Function signature component
  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: "function",
      signature: buildFunctionSignature(sym),
      returnType: sym.returnType,
      typeParameters: sym.typeParameters,
      deprecated: sym.deprecated,
      sourceFile: options.includeSourceLinks ? sym.sourceFile : undefined,
      anchor: options.includeAnchors ? `fn-${sym.name}` : undefined,
    },
  });

  // Deprecation callout
  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  // Description
  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  // Type parameters
  if (sym.typeParameters !== undefined && sym.typeParameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "TypeParameterTable",
      props: { typeParameters: sym.typeParameters },
    });
  }

  // Parameters table
  if (sym.parameters !== undefined && sym.parameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "ParameterTable",
      props: {
        parameters: sym.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
          required: p.required,
          defaultValue: p.defaultValue,
          rest: p.rest,
        })),
      },
    });
  }

  // Return type
  if (sym.returnType !== undefined && sym.returnType !== "void") {
    blocks.push({
      kind: "custom",
      component: "TypeDisplay",
      props: {
        label: "Returns",
        type: sym.returnType,
      },
    });
  }

  // Examples
  if (sym.documentation.examples.length > 0) {
    for (const example of sym.documentation.examples) {
      blocks.push({
        kind: "code",
        language: example.language,
        code: example.code,
        title: example.title,
      });
    }
  }

  // Throws documentation
  if (sym.documentation.throws.length > 0) {
    blocks.push({ kind: "heading", level: 3, text: "Throws" });
    for (const t of sym.documentation.throws) {
      const text = t.type !== undefined ? `\`${t.type}\`: ${t.description}` : t.description;
      blocks.push({ kind: "paragraph", text });
    }
  }

  // See also
  if (sym.documentation.see.length > 0) {
    const items = sym.documentation.see.map((s) =>
      s.url !== undefined ? `[${s.text}](${s.url})` : `\`${s.text}\``,
    );
    blocks.push({
      kind: "list",
      ordered: false,
      items,
    });
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Generate blocks for a class symbol. */
function generateClassBlocks(
  sym: ApiSymbol,
  _graph: ApiGraph,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  // Class signature
  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: "class",
      signature: buildClassSignature(sym),
      typeParameters: sym.typeParameters,
      deprecated: sym.deprecated,
      sourceFile: options.includeSourceLinks ? sym.sourceFile : undefined,
      anchor: options.includeAnchors ? `class-${sym.name}` : undefined,
    },
  });

  // Deprecation
  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  // Description
  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  // Type parameters
  if (sym.typeParameters !== undefined && sym.typeParameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "TypeParameterTable",
      props: { typeParameters: sym.typeParameters },
    });
  }

  // Heritage
  if (sym.extends !== undefined || (sym.implements !== undefined && sym.implements.length > 0)) {
    blocks.push({
      kind: "custom",
      component: "HeritageDisplay",
      props: {
        extends: sym.extends,
        implements: sym.implements,
      },
    });
  }

  // Constructor parameters
  if (sym.parameters !== undefined && sym.parameters.length > 0) {
    blocks.push({ kind: "heading", level: 3, text: "Constructor" });
    blocks.push({
      kind: "custom",
      component: "ParameterTable",
      props: {
        parameters: sym.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
          required: p.required,
          defaultValue: p.defaultValue,
          rest: p.rest,
        })),
      },
    });
  }

  // Members
  if (sym.members !== undefined && sym.members.length > 0) {
    blocks.push({ kind: "heading", level: 3, text: "Members" });

    const displayMembers = sym.members.slice(0, options.maxMembers);
    blocks.push({
      kind: "custom",
      component: "ApiMemberList",
      props: {
        members: displayMembers.map((m) => ({
          name: m.name,
          kind: m.kind,
          signature: m.signature,
          description: m.description,
          required: m.required,
          static: m.static,
          readonly: m.readonly,
          access: m.access,
          deprecated: m.deprecated,
        })),
      },
    });

    if (sym.members.length > options.maxMembers) {
      blocks.push({
        kind: "paragraph",
        text: `... and ${sym.members.length - options.maxMembers} more members.`,
      });
    }
  }

  // Examples
  if (sym.documentation.examples.length > 0) {
    for (const example of sym.documentation.examples) {
      blocks.push({
        kind: "code",
        language: example.language,
        code: example.code,
        title: example.title,
      });
    }
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Generate blocks for an interface symbol. */
function generateInterfaceBlocks(
  sym: ApiSymbol,
  _graph: ApiGraph,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  // Interface signature
  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: "interface",
      signature: buildInterfaceSignature(sym),
      typeParameters: sym.typeParameters,
      deprecated: sym.deprecated,
      sourceFile: options.includeSourceLinks ? sym.sourceFile : undefined,
      anchor: options.includeAnchors ? `interface-${sym.name}` : undefined,
    },
  });

  // Deprecation
  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  // Description
  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  // Type parameters
  if (sym.typeParameters !== undefined && sym.typeParameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "TypeParameterTable",
      props: { typeParameters: sym.typeParameters },
    });
  }

  // Heritage
  if (sym.extends !== undefined) {
    blocks.push({
      kind: "custom",
      component: "HeritageDisplay",
      props: {
        extends: sym.extends,
      },
    });
  }

  // Members
  if (sym.members !== undefined && sym.members.length > 0) {
    blocks.push({ kind: "heading", level: 3, text: "Members" });

    const displayMembers = sym.members.slice(0, options.maxMembers);
    blocks.push({
      kind: "custom",
      component: "ApiMemberList",
      props: {
        members: displayMembers.map((m) => ({
          name: m.name,
          kind: m.kind,
          signature: m.signature,
          description: m.description,
          required: m.required,
          static: m.static,
          readonly: m.readonly,
          access: m.access,
          deprecated: m.deprecated,
        })),
      },
    });

    if (sym.members.length > options.maxMembers) {
      blocks.push({
        kind: "paragraph",
        text: `... and ${sym.members.length - options.maxMembers} more members.`,
      });
    }
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Generate blocks for a type alias. */
function generateTypeAliasBlocks(
  sym: ApiSymbol,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: "type-alias",
      signature: buildTypeAliasSignature(sym),
      typeParameters: sym.typeParameters,
      deprecated: sym.deprecated,
      anchor: options.includeAnchors ? `type-${sym.name}` : undefined,
    },
  });

  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  if (sym.returnType !== undefined) {
    blocks.push({
      kind: "custom",
      component: "TypeDisplay",
      props: {
        label: "Definition",
        type: sym.returnType,
      },
    });
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Generate blocks for an enum. */
function generateEnumBlocks(
  sym: ApiSymbol,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: "enum",
      signature: `enum ${sym.name}`,
      deprecated: sym.deprecated,
      anchor: options.includeAnchors ? `enum-${sym.name}` : undefined,
    },
  });

  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  if (sym.enumMembers !== undefined && sym.enumMembers.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Member", "Value", "Description"],
      rows: sym.enumMembers.map((m) => [
        `\`${m.name}\``,
        `\`${String(m.value)}\``,
        m.description,
      ]),
    });
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Generate blocks for a variable or constant. */
function generateVariableBlocks(
  sym: ApiSymbol,
  options: ApiPageGeneratorOptions & Required<Pick<ApiPageGeneratorOptions, "maxMembers" | "includeAnchors">>,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: sym.kind,
      signature: `${sym.kind === "constant" ? "const" : "const"} ${sym.name}: ${sym.returnType ?? "unknown"}`,
      returnType: sym.returnType,
      deprecated: sym.deprecated,
      anchor: options.includeAnchors ? `var-${sym.name}` : undefined,
    },
  });

  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : `Use the replacement API instead.`;
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  if (sym.returnType !== undefined) {
    blocks.push({
      kind: "custom",
      component: "TypeDisplay",
      props: {
        label: "Type",
        type: sym.returnType,
      },
    });
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

// ─── Signature Builders ───────────────────────────────────────────────────

function buildFunctionSignature(sym: ApiSymbol): string {
  const params =
    sym.parameters
      ?.map((p) => {
        const parts = [p.rest ? "..." : "", p.name];
        if (!p.required) parts.push("?");
        if (p.type !== "any") parts.push(`: ${p.type}`);
        return parts.join("");
      })
      .join(", ") ?? "";
  const typeParams =
    sym.typeParameters !== undefined && sym.typeParameters.length > 0
      ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
      : "";
  return `function ${sym.name}${typeParams}(${params}): ${sym.returnType ?? "void"}`;
}

function buildClassSignature(sym: ApiSymbol): string {
  const typeParams =
    sym.typeParameters !== undefined && sym.typeParameters.length > 0
      ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
      : "";
  const heritage =
    sym.extends !== undefined ? ` extends ${sym.extends}` : "";
  const implements_ =
    sym.implements !== undefined && sym.implements.length > 0
      ? ` implements ${sym.implements.join(", ")}`
      : "";
  return `class ${sym.name}${typeParams}${heritage}${implements_}`;
}

function buildInterfaceSignature(sym: ApiSymbol): string {
  const typeParams =
    sym.typeParameters !== undefined && sym.typeParameters.length > 0
      ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
      : "";
  const heritage = sym.extends !== undefined ? ` extends ${sym.extends}` : "";
  return `interface ${sym.name}${typeParams}${heritage}`;
}

function buildTypeAliasSignature(sym: ApiSymbol): string {
  const typeParams =
    sym.typeParameters !== undefined && sym.typeParameters.length > 0
      ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
      : "";
  return `type ${sym.name}${typeParams} = ${sym.returnType ?? "unknown"}`;
}
