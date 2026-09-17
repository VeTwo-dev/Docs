/**
 * Next.js Documentation Renderer.
 *
 * Transforms a Documentation IR into a complete Next.js (App Router)
 * documentation site. Pure: no filesystem, compiler, AI or source-code
 * access — the IR is the only input.
 */

import { IR_SCHEMA_VERSION, type DocumentationIR } from "../../documentation/compiler/ir.js";
import type { RenderedFile, RenderedSite, SiteRenderer, SiteRendererOptions } from "../types.js";
import { buildOutputPlan } from "../output-plan.js";
import { generateScaffold, generatedTypesFile } from "./scaffold.js";
import type { GeneratedPageData } from "./scaffold.js";

export type NextJsRendererOptions = SiteRendererOptions;

/** Create the Next.js site renderer. */
export function createNextJsRenderer(): SiteRenderer<NextJsRendererOptions> {
  return {
    target: "nextjs",
    render(ir, options = {}) {
      return renderNextJsSite(ir, options);
    },
  };
}

/** Pure IR → file map transformation. */
export function renderNextJsSite(
  ir: DocumentationIR,
  options: NextJsRendererOptions = {},
): RenderedSite {
  const siteName = options.siteName ?? "Documentation";
  // Single route authority: the canonical output plan (not a parallel derivation).
  const plan = buildOutputPlan(ir, { workspaceRoot: "", docsBasePath: options.docsBasePath });
  const routes = plan.pages.map((p) => ({
    slug: p.slug,
    route: p.route,
    title: p.title,
    sectionId: p.sectionId,
    sectionTitle: p.sectionTitle,
  }));

  // Sidebar from the canonical plan navigation (already slug-validated).
  const routeBySlug = new Map(routes.map((r) => [r.slug, r]));
  const sidebar = plan.navigation
    .map((node) => ({
      title: node.label,
      items: [
        ...(node.slug !== undefined ? toLinkItem(node.slug, node.label, routeBySlug) : []),
        ...(node.children ?? []).flatMap((child) =>
          child.slug !== undefined ? toLinkItem(child.slug, child.label, routeBySlug) : [],
        ),
      ],
    }))
    .filter((group) => group.items.length > 0);

  const scaffoldInput = {
    siteName,
    description: options.description,
    baseUrl: options.baseUrl,
    routes: routes.map((r) => ({
      slug: r.slug,
      route: r.route,
      title: r.title,
      sectionTitle: r.sectionTitle,
    })),
    sidebar,
  };

  const files: RenderedFile[] = [
    ...generateScaffold(scaffoldInput),
    generatedTypesFile(),
    ...routes.flatMap((route): RenderedFile[] => {
      const page = ir.pages.find((p) => p.slug === route.slug);
      if (page === undefined) return [];

      const data: GeneratedPageData = {
        schemaVersion: IR_SCHEMA_VERSION,
        slug: page.slug,
        title: page.title,
        ...(page.description !== undefined && page.description.length > 0
          ? { description: page.description }
          : {}),
        sectionId: page.sectionId,
        sectionTitle: route.sectionTitle,
        breadcrumbs: (ir.navigation.breadcrumbs[page.slug] ?? []).map((crumb) => {
          const target = crumb.slug !== undefined ? routeBySlug.get(crumb.slug) : undefined;
          return {
            label: crumb.label,
            ...(target !== undefined ? { href: target.route } : {}),
          };
        }),
        blocks: page.blocks as unknown as readonly Record<string, unknown>[],
        related: page.references
          .filter((ref) => ref.targetSlug !== undefined)
          .flatMap((ref) => {
            const targetRoute = routeBySlug.get(ref.targetSlug ?? "");
            if (targetRoute === undefined) return [];
            return [
              {
                label: targetRoute.title,
                href: targetRoute.route,
                kind: ref.relationship,
              },
            ];
          }),
      };

      // NOTE: Markdown/MDX output is owned by the Markdown renderer (`md/`),
      // never by the Next.js site. Page JSON here is the runtime data model.
      return [
        {
          path: `data/pages/${encodeURIComponent(page.slug)}.json`,
          contents: `${JSON.stringify(data, null, 2)}\n`,
        },
      ];
    }),
  ];

  return {
    target: "nextjs",
    files,
    routes,
    entrypoint: "app/layout.tsx",
  };
}

function toLinkItem(
  slug: string,
  label: string,
  routeBySlug: Map<string, { route: string }>,
): { label: string; href: string }[] {
  const route = routeBySlug.get(slug);
  if (route === undefined) return [];
  return [{ label, href: route.route }];
}
