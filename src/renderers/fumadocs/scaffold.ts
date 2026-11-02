/**
 * Fumadocs Project Scaffold (Phase 23).
 *
 * Generates a REAL Fumadocs + Next.js documentation application from renderer
 * options + output plan. All framework APIs used here were verified against
 * the installed versions (fumadocs-core/ui 16.x, fumadocs-mdx 15.x,
 * Tailwind CSS v4):
 * - `defineDocs`/`defineConfig` from `fumadocs-mdx/config`
 * - `createMDX` from `fumadocs-mdx/next`
 * - `loader` from `fumadocs-core/source`
 * - `DocsLayout` from `fumadocs-ui/layouts/docs`, `RootProvider` from
 *   `fumadocs-ui/provider/next`, `defaultMdxComponents` from `fumadocs-ui/mdx`
 * - `createSearchAPI`/`createFromSource` from `fumadocs-core/search/server`
 *
 * All generators are pure functions from options to file contents.
 */

import type { RenderedFile } from "../types.js";
import type { RendererNavLink, RendererTheme } from "../types.js";
import { defaultDesignCss, themeOverrideCss } from "../design/sources.js";

/** Pinned dependency versions for the generated project (validated majors). */
export const FUMADOCS_DEPS = {
  "fumadocs-core": "^16.0.0",
  "fumadocs-ui": "^16.0.0",
  "fumadocs-mdx": "^15.0.0",
  next: "^16.0.0",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  tailwindcss: "^4.0.0",
  postcss: "^8.0.0",
  "@tailwindcss/postcss": "^4.0.0",
  graphology: "^0.26.0",
  sigma: "^3.0.0",
} as const;

/** Data needed to generate the Fumadocs scaffold. */
export interface FumadocsScaffoldInput {
  readonly siteName: string;
  readonly description?: string;
  readonly baseUrl?: string;
  readonly theme?: RendererTheme;
  readonly navLinks?: readonly RendererNavLink[];
  readonly logoSvg?: string;
  /**
   * Composed design CSS from the persistent `design/` sources (tokens →
   * base → components). Falls back to the embedded default design kit.
   */
  readonly designCss?: string;
  /** Repository URL for header links (from package metadata, never invented). */
  readonly repositoryUrl?: string;
  /** Canonical home route for the root redirect (omitted when `/` serves the home page). */
  readonly homeRedirect?: string;
}

export function generateFumadocsScaffold(input: FumadocsScaffoldInput): readonly RenderedFile[] {
  const files: RenderedFile[] = [
    { path: "package.json", contents: fumadocsPackageJson(input) },
    { path: "next.config.mjs", contents: fumadocsNextConfig() },
    { path: "tsconfig.json", contents: fumadocsTsConfig() },
    { path: "postcss.config.mjs", contents: fumadocsPostcssConfig() },
    { path: "source.config.ts", contents: fumadocsSourceConfig() },
    { path: "app/layout.tsx", contents: fumadocsRootLayout(input) },
    { path: "app/[[...slug]]/page.tsx", contents: fumadocsDocsPage(input) },
    { path: "app/api/search/route.ts", contents: fumadocsSearchRoute() },
    { path: "app/graph/page.tsx", contents: fumadocsGraphPage() },
    { path: "components/graph-view.tsx", contents: fumadocsGraphView() },
    { path: "mdx-components.tsx", contents: fumadocsMdxComponents() },
    { path: "lib/source.ts", contents: fumadocsLibSource() },
    { path: "app/globals.css", contents: fumadocsGlobalsCss(input) },
    { path: ".gitignore", contents: fumadocsGitignore() },
    { path: "README.md", contents: fumadocsReadme(input) },
  ];
  // Configured logo only: no invented branding (graceful when absent).
  if (input.logoSvg !== undefined) {
    files.push(
      { path: "public/logo.svg", contents: `${input.logoSvg}\n` },
      { path: "public/favicon.svg", contents: `${input.logoSvg}\n` },
    );
  }
  // Root redirect only when `/` cannot serve the home page natively
  // (i.e. no `index` slug document exists).
  if (input.homeRedirect !== undefined) {
    files.push({ path: "app/page.tsx", contents: fumadocsHomeRedirect(input.homeRedirect) });
  }
  return files;
}

function fumadocsPackageJson(input: FumadocsScaffoldInput): string {
  return `${JSON.stringify(
    {
      name: `${input.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-docs`,
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "npx serve@latest out",
        preview: "npx serve@latest out",
        "build:static": "next build",
      },
      dependencies: { ...FUMADOCS_DEPS },
    },
    null,
    2,
  )}\n`;
}

function fumadocsNextConfig(): string {
  return `import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  // Webpack builds of a Fumadocs app are memory-hungry; this keeps peak RSS
  // low enough to build on modest CI/dev machines (Turbopack is the default
  // and can still be selected with \`next build\`).
  experimental: { webpackMemoryOptimizations: true },
};

export default withMDX(nextConfig);
`;
}

function fumadocsTsConfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts", ".source/**/*"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )}\n`;
}

function fumadocsPostcssConfig(): string {
  return `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`;
}

function fumadocsSourceConfig(): string {
  return `import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
`;
}

function fumadocsRootLayout(input: FumadocsScaffoldInput): string {
  return `import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(input.siteName)},
  description: ${JSON.stringify(input.description ?? "Documentation")},${
    input.baseUrl !== undefined
      ? `
  metadataBase: new URL(${JSON.stringify(input.baseUrl)}),`
      : ""
  }${
    input.logoSvg !== undefined
      ? `
  icons: { icon: "/favicon.svg" },`
      : ""
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
`;
}

function fumadocsDocsPage(input: FumadocsScaffoldInput): string {
  const links = (input.navLinks ?? [])
    .filter((link) => !link.href.includes("github.com"))
    .map(
      (link) =>
        `    { type: "main", url: ${JSON.stringify(link.href)}, text: ${JSON.stringify(link.label)} },`,
    );
  const github =
    input.repositoryUrl ?? input.navLinks?.find((link) => link.href.includes("github.com"))?.href;
  const linksProp = links.length > 0 ? `\n  links={[\n${links.join("\n")}\n  ]}` : "";
  const githubProp = github !== undefined ? `\n  githubUrl={${JSON.stringify(github)}}` : "";
  return `import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";

export function generateStaticParams(): { slug?: string[] }[] {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (page === undefined) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export default async function DocsPage(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (page === undefined) notFound();
  const MDX = page.data.body;

  return (
    <DocsLayout tree={source.pageTree}${linksProp}${githubProp}>
      <article className="vetwo-article">
        <h1>{page.data.title}</h1>
        {page.data.description ? (
          <p className="vetwo-doc-description">{page.data.description}</p>
        ) : null}
        <MDX components={getMDXComponents()} />
      </article>
    </DocsLayout>
  );
}
`;
}

function fumadocsSearchRoute(): string {
  // staticGET (not GET): exports a static search index so the route
  // prerenders under `output: "export"` instead of requiring a server.
  return `import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

export const dynamic = "force-static";

export const { staticGET: GET } = createFromSource(source);
`;
}

/**
 * Root landing redirect for sites without a home (`index`) document.
 * Client-side navigation keeps `output: "export"` static-safe; the plain
 * link preserves keyboard and no-JavaScript access to the same destination.
 */
function fumadocsHomeRedirect(homeRoute: string): string {
  const target = JSON.stringify(homeRoute);
  return `'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomeRedirect(): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    router.replace(${target});
  }, [router]);
  return (
    <main className="vetwo-article">
      <p>
        <a href=${target}>Continue to the documentation</a>
      </p>
    </main>
  );
}
`;
}

function fumadocsGraphPage(): string {
  // GraphView is a client component that lazy-loads Sigma at runtime, so the
  // page itself prerenders statically without `ssr: false` (forbidden here).
  return `import type { Metadata } from "next";
import GraphView from "@/components/graph-view";

export const metadata: Metadata = {
  title: "Documentation Graph",
  description: "Interactive graph of pages, APIs, concepts and relationships.",
};

export default function GraphPage(): React.JSX.Element {
  return (
    <main className="vetwo-graph-page">
      <h1>Documentation Graph</h1>
      <GraphView />
    </main>
  );
}
`;
}

function fumadocsGraphView(): string {
  return `'use client';

import { useEffect, useRef, useState } from "react";
import type Graph from "graphology";

interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly url?: string;
}

interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly { readonly from: string; readonly to: string; readonly kind?: string }[];
}

export default function GraphView(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let renderer: { kill: () => void } | undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: GraphImpl }, Sigma] = await Promise.all([
          import("graphology"),
          import("sigma"),
        ]);
        const res = await fetch("/graph.json");
        if (!res.ok) throw new Error(\`graph.json: \${res.status}\`);
        const data = (await res.json()) as GraphData;
        if (cancelled || containerRef.current === null) return;
        const graph = new GraphImpl({ multi: true }) as unknown as Graph;
        for (const node of data.nodes) {
          if (!graph.hasNode(node.id)) {
            graph.addNode(node.id, { label: node.label, kind: node.kind, url: node.url, size: 6 });
          }
        }
        for (const edge of data.edges) {
          if (graph.hasNode(edge.from) && graph.hasNode(edge.to)) {
            graph.addEdge(edge.from, edge.to, { kind: edge.kind ?? "related" });
          }
        }
        // Deterministic circular layout (no layout worker dependency).
        const ids = graph.nodes();
        ids.forEach((id, i) => {
          const angle = (2 * Math.PI * i) / Math.max(ids.length, 1);
          graph.setNodeAttribute(id, "x", Math.cos(angle));
          graph.setNodeAttribute(id, "y", Math.sin(angle));
        });
        const SigmaImpl = (Sigma as unknown as { default: new (g: unknown, c: HTMLElement) => { kill: () => void } }).default;
        renderer = new SigmaImpl(graph, containerRef.current);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      renderer?.kill();
    };
  }, []);

  if (error !== undefined) {
    return <p role="alert">Graph unavailable: {error}</p>;
  }
  return <div ref={containerRef} className="vetwo-graph-canvas" style={{ height: "70vh" }} />;
}
`;
}

function fumadocsMdxComponents(): string {
  return `import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
`;
}

function fumadocsLibSource(): string {
  return `import { docs } from "@/.source/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});
`;
}

function fumadocsGlobalsCss(input: FumadocsScaffoldInput): string {
  // Note: no `@source` entries with glob metacharacters (e.g. `[[...slug]]`
  // route directories) — Tailwind interprets them as glob patterns and the
  // PostCSS worker can crash. `@source "."` already covers the app tree.
  //
  // Emission layers (later wins):
  //   1. Tailwind + fumadocs-ui imports (their --color-fd-* defaults).
  //   2. VeTwo design sources (tokens → base → components), verbatim.
  //   3. Fumadocs adapter: --color-fd-* mirrors the design tokens once;
  //      custom-property indirection resolves per element, so both the
  //      explicit `.dark` toggle and OS dark mode stream through.
  //   4. docs.config.ts theme overrides (short-circuit the palette).
  const design = input.designCss ?? defaultDesignCss();
  return `@import "tailwindcss";
@source ".";
@source "../components";
@source "../content";
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";

${design}

:root {
  --color-fd-background: var(--vetwo-bg);
  --color-fd-foreground: var(--vetwo-fg);
  --color-fd-card: var(--vetwo-surface);
  --color-fd-card-foreground: var(--vetwo-fg);
  --color-fd-muted: var(--vetwo-surface);
  --color-fd-muted-foreground: var(--vetwo-muted);
  --color-fd-secondary: var(--vetwo-surface-2);
  --color-fd-secondary-foreground: var(--vetwo-fg);
  --color-fd-popover: var(--vetwo-bg);
  --color-fd-popover-foreground: var(--vetwo-fg);
  --color-fd-border: var(--vetwo-border);
  --color-fd-accent: var(--vetwo-accent-dim);
  --color-fd-accent-foreground: var(--vetwo-fg);
  --color-fd-primary: var(--vetwo-accent);
  --color-fd-primary-foreground: var(--vetwo-on-accent);
  --color-fd-ring: var(--vetwo-accent);
  --color-fd-overlay: var(--vetwo-overlay);
  --color-fd-info: var(--vetwo-tone-note);
  --color-fd-warning: var(--vetwo-tone-warning);
  --color-fd-success: var(--vetwo-accent);
  --color-fd-error: var(--vetwo-tone-danger);
  --color-fd-diff-add: var(--vetwo-tone-tip-bg);
  --color-fd-diff-add-symbol: var(--vetwo-accent);
  --color-fd-diff-remove: var(--vetwo-tone-danger-bg);
  --color-fd-diff-remove-symbol: var(--vetwo-tone-danger);
}

${themeOverrideCss(input.theme)}
`;
}

function fumadocsGitignore(): string {
  return ["node_modules/", ".next/", "out/", "next-env.d.ts", ".source/", ""].join("\n");
}

function fumadocsReadme(input: FumadocsScaffoldInput): string {
  return `# ${input.siteName} (Fumadocs)

Documentation site generated by @vetwo/docs as a Fumadocs project.

\`\`\`bash
npm install
npm run dev     # local development (Fumadocs + Next.js)
npm run build   # production build
npm start       # serve the production build
\`\`\`

Content lives in \`content/docs/*.mdx\` (generated MDX, human-editable).
Navigation order lives in \`content/docs/meta.json\` files.
The documentation graph lives in \`public/graph.json\`.
`;
}
