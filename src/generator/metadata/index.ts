import type { GeneratorContext, GeneratedPage, GeneratedMetadata } from "../core/types.js";

/**
 * Generates sidebar metadata JSON from generated pages.
 */
export function generateSidebarMetadata(
  _ctx: GeneratorContext,
  pages: readonly GeneratedPage[],
): GeneratedMetadata {
  const groups = new Map<string, Array<{ label: string; href: string }>>();

  for (const page of pages) {
    const group = groups.get(page.category) ?? [];
    group.push({
      label: page.title,
      href: `/${page.slug}`,
    });
    groups.set(page.category, group);
  }

  const sidebar = {
    auto: false,
    groups: [...groups.entries()].map(([title, items]) => ({
      title,
      items,
    })),
  };

  return {
    filename: "metadata/sidebar.json",
    content: JSON.stringify(sidebar, null, 2),
    kind: "json",
  };
}

/**
 * Generates navigation metadata JSON from generated pages.
 * Navigation items are derived from the pages that were actually generated,
 * sorted by category and order.
 */
export function generateNavigationMetadata(
  _ctx: GeneratorContext,
  pages: readonly GeneratedPage[],
): GeneratedMetadata {
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const nav = {
    items: sorted.map((page) => ({
      label: page.title,
      href: `/${page.slug}`,
      category: page.category,
    })),
  };

  return {
    filename: "metadata/navigation.json",
    content: JSON.stringify(nav, null, 2),
    kind: "json",
  };
}

/**
 * Generates search metadata JSON from generated pages.
 */
export function generateSearchMetadata(
  _ctx: GeneratorContext,
  pages: readonly GeneratedPage[],
): GeneratedMetadata {
  const entries = pages.map((page) => ({
    id: page.slug,
    title: page.title,
    content: page.description,
    url: `/${page.slug}`,
    category: page.category,
  }));

  return {
    filename: "metadata/search.json",
    content: JSON.stringify({ entries, generatedAt: new Date().toISOString() }, null, 2),
    kind: "json",
  };
}

/**
 * Generates API metadata JSON from the analysis.
 */
export function generateApiMetadata(ctx: GeneratorContext): GeneratedMetadata {
  const api = {
    title: ctx.analysis.packageInfo?.name ?? "API",
    description: ctx.analysis.packageInfo?.description ?? "",
    exports: ctx.analysis.publicExports.map((exp) => ({
      name: exp.name,
      kind: exp.kind,
      description: exp.description,
      signature: exp.signature,
      sourceFile: exp.sourceFile,
    })),
  };

  return {
    filename: "metadata/api.json",
    content: JSON.stringify(api, null, 2),
    kind: "json",
  };
}
