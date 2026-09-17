import type { SyntaxNode } from "../../compiler/index.js";
import { nowMs } from "../../compiler/index.js";
import type { ReferenceResolver } from "../contracts/resolver.js";
import { createReferenceResolver } from "../contracts/resolver.js";
import type {
  ReferenceCapabilityName,
  ReferenceCapabilityValue,
} from "../contracts/capabilities.js";
import type {
  ReferenceExportBinding,
  ReferenceFileBindings,
  ReferenceImportBinding,
} from "../models/index.js";
import type { ReferenceDiagnostic } from "../models/index.js";
import { createReferenceDiagnostic } from "../models/index.js";
import type { ReferenceBindingInput } from "../contracts/input.js";
import type { ReferenceBindingOutput, ReferenceBindingStatistics } from "../contracts/output.js";
import { DEFAULT_NAME, STAR_NAME } from "../shared/index.js";

/** Options for the shared binding-extraction resolver factory. */
export interface BindingExtractorConfig {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly languageId: string;
  readonly capabilities?: Partial<Record<ReferenceCapabilityName, ReferenceCapabilityValue>>;
}

/**
 * Creates a reference resolver that recovers import/export name bindings by
 * walking the normalized syntax trees. TypeScript and Babel trees both expose
 * the same coarse node kinds, so one shared walk serves both languages.
 */
export function createBindingExtractor(config: BindingExtractorConfig): ReferenceResolver {
  return createReferenceResolver({
    metadata: {
      id: config.id,
      languageId: config.languageId,
      displayName: config.displayName,
      version: config.version,
      priority: 0,
      source: "builtin",
    },
    capabilities: config.capabilities ?? {},
    extractBindings: (input) => extractAll(input, config),
  });
}

function extractAll(
  input: ReferenceBindingInput,
  config: BindingExtractorConfig,
): ReferenceBindingOutput {
  const started = nowMs();
  const bindings: Record<string, ReferenceFileBindings> = {};
  const diagnostics: ReferenceDiagnostic[] = [];
  let extractedFiles = 0;
  let bindingsCount = 0;

  for (const unit of input.units) {
    if (unit.status !== "ok" || unit.syntaxTree === undefined) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "broken-symbol-metadata",
          severity: "info",
          message: `Unit "${unit.file}" has no usable syntax tree (status: ${unit.status}).`,
          languageId: input.languageId,
          resolverId: input.resolverId,
          file: unit.file,
        }),
      );
      continue;
    }
    const fileBindings = extractFileBindings(unit.syntaxTree.root, unit.file);
    bindings[unit.file] = fileBindings;
    extractedFiles += 1;
    bindingsCount +=
      fileBindings.imports.length +
      fileBindings.exportAliases.length +
      fileBindings.reExports.length;
  }

  const statistics: ReferenceBindingStatistics = Object.freeze({
    files: input.units.length,
    extractedFiles,
    bindingsCount,
    diagnosticsCount: diagnostics.length,
    extractTimeMs: nowMs() - started,
  });

  return {
    languageId: config.languageId,
    resolverId: config.id,
    bindings,
    diagnostics,
    statistics,
  };
}

/** Recovers the import/export bindings of one file from its tree root. */
export function extractFileBindings(root: SyntaxNode, file: string): ReferenceFileBindings {
  const imports: ReferenceImportBinding[] = [];
  const exportAliases: ReferenceExportBinding[] = [];
  const reExports: ReferenceExportBinding[] = [];

  for (const node of root.children ?? []) {
    switch (node.kind) {
      case "ImportDeclaration": {
        addImportBindings(node, imports);
        break;
      }
      case "ImportEqualsDeclaration": {
        if (node.moduleSpecifier === undefined) break;
        const name = node.name ?? "";
        if (name.length > 0) {
          pushImport(imports, {
            specifier: node.moduleSpecifier,
            localName: name,
            importedName: STAR_NAME,
          });
        }
        break;
      }
      case "ExportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration": {
        addExportBindings(node, exportAliases, reExports);
        break;
      }
      default:
        break;
    }
  }

  return Object.freeze({
    file,
    imports: Object.freeze(imports),
    exportAliases: Object.freeze(exportAliases),
    reExports: Object.freeze(reExports),
  });
}

function addImportBindings(node: SyntaxNode, imports: ReferenceImportBinding[]): void {
  const specifier = node.moduleSpecifier;
  if (specifier === undefined) return;
  const seen = new Set<string>();

  const candidates: SyntaxNode[] = [...(node.children ?? [])];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (candidate.kind === "ImportClause" || candidate.kind === "NamedImports") {
      candidates.push(...(candidate.children ?? []));
    }
  }

  for (const candidate of candidates) {
    const kind = candidate.kind;
    if (kind === "ImportSpecifier") {
      const localName = candidate.name ?? candidate.propertyName ?? "";
      const importedName =
        candidate.propertyName !== undefined && candidate.propertyName !== candidate.name
          ? candidate.propertyName
          : (candidate.name ?? "");
      if (localName.length === 0) continue;
      pushImport(imports, { specifier, localName, importedName }, seen);
      continue;
    }
    if (kind === "ImportDefaultSpecifier" || kind === "Identifier") {
      const localName = candidate.name ?? "";
      if (localName.length === 0) continue;
      pushImport(imports, { specifier, localName, importedName: DEFAULT_NAME }, seen);
      continue;
    }
    if (kind === "ImportNamespaceSpecifier" || kind === "NamespaceImport") {
      const localName = candidate.name ?? "";
      if (localName.length === 0) continue;
      pushImport(imports, { specifier, localName, importedName: STAR_NAME }, seen);
      continue;
    }
  }
}

function addExportBindings(
  node: SyntaxNode,
  exportAliases: ReferenceExportBinding[],
  reExports: ReferenceExportBinding[],
): void {
  const candidates: SyntaxNode[] = [...(node.children ?? [])];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (candidate.kind === "NamedExports" || candidate.kind === "ExportClause") {
      candidates.push(...(candidate.children ?? []));
    }
  }

  const specifiers: ReferenceExportBinding[] = [];
  for (const candidate of candidates) {
    if (candidate.kind === "ExportSpecifier") {
      const exportedName = candidate.name ?? candidate.propertyName ?? "";
      const localName = candidate.propertyName ?? candidate.name ?? "";
      if (exportedName.length === 0) continue;
      specifiers.push({ exportedName, localName });
    } else if (
      candidate.kind === "NamespaceExport" ||
      candidate.kind === "ExportNamespaceSpecifier"
    ) {
      const exportedName = candidate.name ?? "";
      if (exportedName.length === 0) continue;
      specifiers.push({ exportedName, localName: STAR_NAME });
    }
  }

  const target = node.moduleSpecifier;
  const seen = new Set<string>();
  for (const spec of specifiers) {
    if (target === undefined) {
      pushExport(exportAliases, { ...spec }, seen);
    } else {
      pushExport(reExports, { ...spec, specifier: target }, seen);
    }
  }
}

function pushImport(
  list: ReferenceImportBinding[],
  binding: ReferenceImportBinding,
  seen?: Set<string>,
): void {
  const key = `${binding.specifier}\u0000${binding.localName}`;
  if (seen !== undefined && seen.has(key)) return;
  seen?.add(key);
  list.push(Object.freeze(binding));
}

function pushExport(
  list: ReferenceExportBinding[],
  binding: ReferenceExportBinding,
  seen: Set<string>,
): void {
  const key = `${binding.specifier ?? ""}\u0000${binding.exportedName}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(Object.freeze(binding));
}
