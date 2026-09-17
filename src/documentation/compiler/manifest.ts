/**
 * Documentation Manifest (Phase 22).
 * Structured manifest consumed by Next.js, static renderer, search, CLI, diagnostics.
 */

import type { DocumentationArchitecture } from "./types.js";
import type { DocumentationIR } from "./ir.js";
import type { ApiSymbol } from "../../api/models.js";

export interface DocumentationManifest {
  readonly generatedAt: string;
  readonly pages: readonly { slug: string; title: string; kinds: readonly string[] }[];
  readonly routes: readonly { slug: string; path: string }[];
  readonly symbols: readonly { name: string; kind: string; sourceFile?: string }[];
  readonly packages: readonly { name: string }[];
  readonly categories: readonly string[];
  readonly relationships: DocumentationArchitecture["relationships"];
  readonly sourceMappings: Readonly<Record<string, string>>; // slug -> sourceFile
  readonly searchEntries: number;
  /** Per-renderer file inventory (relative paths) for safe stale-output reconciliation. */
  readonly files?: {
    readonly next: readonly string[];
    readonly md: readonly string[];
    readonly static: readonly string[];
  };
}

export function buildManifest(architecture: DocumentationArchitecture, ir: DocumentationIR, symbols: readonly ApiSymbol[] = []): DocumentationManifest {
  // Manifest describes MATERIALIZED pages (IR), never merely planned ones:
  // every listed page must exist on disk in every renderer root.
  const titles = new Map(architecture.pages.map(p => [p.slug, p]));
  return {
    generatedAt: new Date().toISOString(),
    pages: ir.pages.map(p => {
      const def = titles.get(p.slug);
      return { slug: p.slug, title: p.title, kinds: def !== undefined ? [...def.kinds] : [] };
    }),
    routes: ir.pages.map(p => ({ slug: p.slug, path: `/docs/${p.slug}` })),
    symbols: symbols.map(s => ({ name: s.name, kind: s.kind, sourceFile: s.sourceFile })),
    packages: [{ name: architecture.project.name }],
    categories: [...new Set(architecture.sections.map(s => s.id))],
    relationships: architecture.relationships.filter(
      r => ir.pages.some(p => p.slug === r.from) && ir.pages.some(p => p.slug === r.to),
    ),
    sourceMappings: Object.fromEntries(ir.pages.map(p => {
      const def = titles.get(p.slug);
      return [p.slug, def?.symbols[0] ?? def?.evidence[0]?.value ?? ""];
    })),
    searchEntries: ir.pages.length + symbols.length,
  };
}
