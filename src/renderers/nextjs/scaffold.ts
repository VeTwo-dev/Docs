/**
 * Next.js Documentation Runtime Scaffold.
 *
 * Generates a complete, generic Next.js (App Router) documentation
 * application from renderer options + route manifest. The generated app:
 *
 * - statically imports structured page data (JSON), so `output: "export"`
 *   produces a fully static site with no runtime data fetching;
 * - renders IR blocks through a typed block renderer component;
 * - styles everything with CSS custom properties — no CSS framework
 *   is hardcoded;
 * - renders layout from generated data modules (self-contained, no external UI dependency).
 *
 * All generators are pure functions from options to file contents.
 */

import type { RenderedFile, RendererNavLink, RendererTheme } from "../types.js";

/** GitHub mark used for repository links (inline SVG, no external asset). */
export const GITHUB_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';

/** Derive a deterministic monogram logo from the site name + accent color. */
export function monogramLogoSvg(siteName: string, accent: string): string {
  const letter = (siteName.trim()[0] ?? "D").toUpperCase();
  const safe = letter.replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" role="img" aria-label="${siteName} logo"><rect width="64" height="64" rx="14" fill="${accent}"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${safe}</text></svg>`;
}

/** Data needed to generate the scaffold. */
export interface ScaffoldInput {
  readonly siteName: string;
  readonly description?: string;
  readonly baseUrl?: string;
  readonly theme?: RendererTheme;
  readonly navLinks?: readonly RendererNavLink[];
  readonly logoSvg?: string;
  /** Ordered routes from the manifest. */
  readonly routes: readonly {
    readonly slug: string;
    readonly route: string;
    readonly title: string;
    readonly sectionTitle: string;
  }[];
  /** Sidebar tree: section title → labeled links. */
  readonly sidebar: readonly {
    readonly title: string;
    readonly items: readonly { readonly label: string; readonly href: string }[];
  }[];
}

/** Generate all static scaffold files for the Next.js runtime. */
export function generateScaffold(input: ScaffoldInput): readonly RenderedFile[] {
  const accent = input.theme?.colors?.accent ?? input.theme?.colors?.primary ?? "#2563eb";
  const logo = input.logoSvg ?? monogramLogoSvg(input.siteName, accent);
  return [
    { path: "package.json", contents: packageJson() },
    { path: "next.config.mjs", contents: nextConfig() },
    { path: "tsconfig.json", contents: tsconfig() },
    { path: "app/layout.tsx", contents: rootLayout(input) },
    { path: "app/page.tsx", contents: indexPage(input) },
    { path: "app/docs/[[...slug]]/page.tsx", contents: docsPage() },
    { path: "components/block-renderer.tsx", contents: blockRenderer() },
    { path: "lib/pages.generated.ts", contents: pagesModule(input) },
    { path: "lib/sidebar.generated.ts", contents: sidebarModule(input) },
    { path: "lib/docs-data.ts", contents: docsDataModule(input) },
    { path: "app/globals.css", contents: globalsCss(input.theme) },
    { path: "public/logo.svg", contents: `${logo}\n` },
    { path: "public/favicon.svg", contents: `${logo}\n` },
    { path: ".gitignore", contents: gitignore() },
    { path: "README.md", contents: readme(input) },
  ];
}

/** Shape of one serialized page as consumed by the generated runtime. */
export interface GeneratedPageData {
  /** IR schema version this payload was serialized from (transport versioning). */
  readonly schemaVersion: number;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly breadcrumbs: readonly { readonly label: string; readonly href?: string }[];
  readonly blocks: readonly Record<string, unknown>[];
  readonly related: readonly {
    readonly label: string;
    readonly href: string;
    readonly kind?: string;
  }[];
}

// ─── Static config files ─────────────────────────────────────────────────

function packageJson(): string {
  return `${JSON.stringify(
    {
      name: "documentation-site",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "^16.2.10",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    },
    null,
    2,
  )}\n`;
}

function nextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
`;
}

function tsconfig(): string {
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
      },
      include: ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )}\n`;
}

// ─── App Router sources ──────────────────────────────────────────────────

/** Header navigation links with a GitHub mark for repository links. */
function headerNavLinks(input: ScaffoldInput): string {
  const links = input.navLinks ?? [];
  if (links.length === 0) return "";
  const items = links
    .map((link) => {
      const icon = link.href.includes("github.com")
        ? `<span className="vetwo-header-icon">${GITHUB_ICON_SVG}</span>`
        : "";
      return `              <a className="vetwo-header-link" href=${JSON.stringify(link.href)} target="_blank" rel="noreferrer">${icon}{${JSON.stringify(link.label)}}</a>`;
    })
    .join("\n");
  return `\n            <nav className="vetwo-header-nav" aria-label="External">\n${items}\n            </nav>`;
}

function rootLayout(input: ScaffoldInput): string {
  return `import type { Metadata } from "next";
import { docsData } from "../lib/docs-data";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(input.siteName)},
  description: ${JSON.stringify(input.description ?? "Documentation")},
  icons: { icon: "/favicon.svg" },${
    input.baseUrl !== undefined
      ? `
  metadataBase: new URL(${JSON.stringify(input.baseUrl)}),`
      : ""
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="vetwo-header">
          <a className="vetwo-brand" href="/">
            <img className="vetwo-logo" src="/logo.svg" alt="" width="28" height="28" />
            <span>{docsData.siteName}</span>
          </a>${headerNavLinks(input)}
        </header>
        <div className="vetwo-layout">
          <aside className="vetwo-sidebar">
            <h1>{docsData.siteName}</h1>
            <p>{docsData.description}</p>
            <nav>
              {docsData.sidebar.map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.href}><a href={item.href}>{item.label}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <main className="vetwo-main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
`;
}

function indexPage(input: ScaffoldInput): string {
  const firstRoute = input.routes[0]?.route;
  // Never redirect to a route that does not exist. With zero pages,
  // render a valid empty-state page instead of a broken redirect.
  if (firstRoute === undefined) {
    return `export default function Home(): React.JSX.Element {
  return (
    <article className="vetwo-doc-article">
      <h1>${JSON.stringify(input.siteName)}</h1>
      <p>No documentation pages were generated.</p>
    </article>
  );
}
`;
  }
  return `import { redirect } from "next/navigation";

export default function Home(): never {
  redirect(${JSON.stringify(firstRoute)});
}
`;
}

/**
 * The dynamic docs route (optional catch-all): resolves page data from the
 * generated record, so the whole site exports statically. Nested slugs
 * (`api/overview`) map to `app/docs/api/overview/` via split segments.
 */
function docsPage(): string {
  return `import { notFound } from "next/navigation";
import { BlockRenderer, type IRBlock } from "../../../components/block-renderer";
import { allPages, getRelated } from "../../../lib/pages.generated";

interface Params {
  readonly slug?: readonly string[];
}

export function generateStaticParams(): Params[] {
  return Object.keys(allPages).map((slug) => ({ slug: slug.split("/") }));
}

export default async function DocsPageRoute({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug: segments } = await params;
  const slug = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  const page = allPages[slug];
  if (page === undefined) notFound();

  // Transport-shape guard: page JSON is serialized IR, not a semantic model.
  // Stale or corrupt payloads fail loudly instead of rendering wrong docs.
  if (
    typeof page.slug !== "string" ||
    typeof page.title !== "string" ||
    !Array.isArray((page as { blocks?: unknown }).blocks)
  ) {
    throw new Error(\`Invalid documentation data for page "\${slug}" (schema v\${String((page as { schemaVersion?: unknown }).schemaVersion ?? "?")}); regenerate the site.\`);
  }

  const related = getRelated(slug);

  return (
    <article className="vetwo-doc-article">
      <header className="vetwo-doc-header">
        <p className="vetwo-doc-section">{page.sectionTitle}</p>
        <h1>{page.title}</h1>
        {page.description !== undefined && page.description.length > 0 ? (
          <p className="vetwo-doc-description">{page.description}</p>
        ) : null}
        <nav className="vetwo-breadcrumbs" aria-label="Breadcrumb">
          {page.breadcrumbs.map((crumb, i) => (
            <span key={i} className="vetwo-breadcrumb-item">
              {crumb.href !== undefined ? (
                <a href={crumb.href}>{crumb.label}</a>
              ) : (
                crumb.label
              )}
              <span aria-hidden>{" /"}</span>
            </span>
          ))}
        </nav>
      </header>
      <BlockRenderer blocks={page.blocks as unknown as readonly IRBlock[]} />
      {related.length > 0 ? (
        <footer className="vetwo-related">
          <h2>Related</h2>
          <ul>
            {related.map((rel) => (
              <li key={rel.href}>
                <a href={rel.href}>{rel.label}</a>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
`;
}

// ─── Components & generated data modules ─────────────────────────────────

/** Typed renderer mapping IR blocks to semantic HTML, including API-specific components. */
function blockRenderer(): string {
  return `import React from "react";

export interface IRBlock {
  kind: string;
  text?: string;
  level?: number;
  language?: string;
  code?: string;
  title?: string;
  ordered?: boolean;
  items?: readonly string[];
  tone?: string;
  headers?: readonly string[];
  rows?: readonly string[][];
  component?: string;
  props?: Record<string, unknown>;
}

const CALLOUT_LABELS: Record<string, string> = {
  note: "Note",
  warning: "Warning",
  deprecated: "Deprecated",
  tip: "Tip",
};

const KIND_BADGES: Record<string, string> = {
  function: "fn",
  class: "class",
  interface: "interface",
  "type-alias": "type",
  enum: "enum",
  variable: "let",
  constant: "const",
  method: "method",
  property: "prop",
  constructor: "ctor",
};

export function BlockRenderer({
  blocks,
}: {
  blocks: readonly IRBlock[];
}): React.JSX.Element {
  return (
    <div className="vetwo-blocks">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: IRBlock }): React.JSX.Element | null {
  switch (block.kind) {
    case "heading": {
      const level = Math.min(Math.max(block.level ?? 2, 1), 6);
      const Tag = \`h\${level}\` as keyof React.JSX.IntrinsicElements;
      return React.createElement(Tag, null, block.text);
    }
    case "paragraph":
      return <p>{renderInline(block.text ?? "")}</p>;
    case "code":
      return (
        <div className="vetwo-code-block">
          {block.title !== undefined && block.title.length > 0 && (
            <div className="vetwo-code-title">{block.title}</div>
          )}
          <pre className="vetwo-code" data-language={block.language}>
            <code>{block.code}</code>
          </pre>
        </div>
      );
    case "list": {
      const items = block.items ?? [];
      return block.ordered === true ? (
        <ol>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    case "callout": {
      const label = CALLOUT_LABELS[block.tone ?? "note"] ?? "Note";
      return (
        <aside className={\`vetwo-callout vetwo-callout-\${block.tone ?? "note"}\`}>
          <strong>{label}.</strong> {renderInline(block.text ?? "")}
        </aside>
      );
    }
    case "table": {
      const headers = block.headers ?? [];
      const rows = block.rows ?? [];
      return (
        <table className="vetwo-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "custom": {
      const component = block.component ?? "";
      const props = block.props ?? {};
      return renderCustomComponent(component, props);
    }
    default:
      return null;
  }
}

// ─── API-Specific Components ──────────────────────────────────────────────

function renderCustomComponent(
  component: string,
  props: Record<string, unknown>,
): React.JSX.Element {
  switch (component) {
    case "ApiSignature":
      return <ApiSignature {...props as ApiSignatureProps} />;
    case "ParameterTable":
      return <ParameterTable {...props as ParameterTableProps} />;
    case "TypeDisplay":
      return <TypeDisplay {...props as TypeDisplayProps} />;
    case "TypeParameterTable":
      return <TypeParameterTable {...props as TypeParameterTableProps} />;
    case "HeritageDisplay":
      return <HeritageDisplay {...props as HeritageDisplayProps} />;
    case "ApiMemberList":
      return <ApiMemberList {...props as ApiMemberListProps} />;
    default: {
      // Fallback: render as data-attribute placeholder
      const entries = Object.entries(props).filter(([k]) => k !== "children");
      const children = props["children"];
      return (
        <div
          className="vetwo-custom-component"
          data-component={component}
          {...Object.fromEntries(
            entries.map(([k, v]) => [\`data-\${k}\`, typeof v === "string" ? v : JSON.stringify(v)])
          )}
        >
          {typeof children === "string" && children.length > 0 ? children : null}
        </div>
      );
    }
  }
}

interface ApiSignatureProps {
  name?: string;
  kind?: string;
  signature?: string;
  returnType?: string;
  typeParameters?: readonly { name: string; constraint?: string; default?: string }[];
  deprecated?: boolean | string;
  sourceFile?: string;
  line?: number;
  anchor?: string;
}

function ApiSignature({ name, kind, signature, deprecated, anchor }: ApiSignatureProps): React.JSX.Element {
  const badge = KIND_BADGES[kind ?? ""] ?? kind ?? "";
  return (
    <div className="vetwo-api-signature" id={anchor}>
      <div className="vetwo-api-header">
        <span className={\`vetwo-api-badge vetwo-api-badge-\${kind ?? "unknown"}\`}>{badge}</span>
        <h3 className="vetwo-api-name">{name}</h3>
        {deprecated !== false && deprecated !== undefined && (
          <span className="vetwo-api-deprecated">Deprecated</span>
        )}
      </div>
      <pre className="vetwo-api-code">
        <code>{signature}</code>
      </pre>
    </div>
  );
}

interface ParameterTableProps {
  parameters?: readonly {
    name: string;
    type: string;
    description: string;
    required: boolean;
    defaultValue?: string;
    rest: boolean;
  }[];
}

function ParameterTable({ parameters }: ParameterTableProps): React.JSX.Element {
  if (parameters === undefined || parameters.length === 0) return <></>;
  return (
    <div className="vetwo-param-section">
      <h4 className="vetwo-param-title">Parameters</h4>
      <table className="vetwo-table vetwo-param-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((p, i) => (
            <tr key={i}>
              <td>
                <code className="vetwo-param-name">
                  {p.rest ? "..." : ""}{p.name}{p.required === false ? "?" : ""}
                </code>
              </td>
              <td><code className="vetwo-param-type">{p.type}</code></td>
              <td>
                {renderInline(p.description)}
                {p.defaultValue !== undefined && p.defaultValue.length > 0 && (
                  <span className="vetwo-param-default"> Default: <code>{p.defaultValue}</code></span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TypeDisplayProps {
  label?: string;
  type?: string;
}

function TypeDisplay({ label, type }: TypeDisplayProps): React.JSX.Element {
  if (type === undefined || type.length === 0) return <></>;
  return (
    <div className="vetwo-type-display">
      {label !== undefined && label.length > 0 && (
        <span className="vetwo-type-label">{label}: </span>
      )}
      <code className="vetwo-type-value">{type}</code>
    </div>
  );
}

interface TypeParameterTableProps {
  typeParameters?: readonly { name: string; constraint?: string; default?: string }[];
}

function TypeParameterTable({ typeParameters }: TypeParameterTableProps): React.JSX.Element {
  if (typeParameters === undefined || typeParameters.length === 0) return <></>;
  return (
    <div className="vetwo-type-param-section">
      <h4 className="vetwo-type-param-title">Type Parameters</h4>
      <table className="vetwo-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Constraint</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {typeParameters.map((tp, i) => (
            <tr key={i}>
              <td><code>{tp.name}</code></td>
              <td>{tp.constraint !== undefined ? <code>{tp.constraint}</code> : <span className="vetwo-muted">—</span>}</td>
              <td>{tp.default !== undefined ? <code>{tp.default}</code> : <span className="vetwo-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface HeritageDisplayProps {
  extends?: string;
  implements?: readonly string[];
}

function HeritageDisplay({ extends: extendsType, implements: implementsTypes }: HeritageDisplayProps): React.JSX.Element {
  if (extendsType === undefined && (implementsTypes === undefined || implementsTypes.length === 0)) {
    return <></>;
  }
  return (
    <div className="vetwo-heritage">
      {extendsType !== undefined && (
        <div className="vetwo-heritage-item">
          <span className="vetwo-heritage-label">Extends</span>
          <code className="vetwo-heritage-type">{extendsType}</code>
        </div>
      )}
      {implementsTypes !== undefined && implementsTypes.length > 0 && (
        <div className="vetwo-heritage-item">
          <span className="vetwo-heritage-label">Implements</span>
          {implementsTypes.map((t, i) => (
            <code key={i} className="vetwo-heritage-type">{t}{i < implementsTypes.length - 1 ? ", " : ""}</code>
          ))}
        </div>
      )}
    </div>
  );
}

interface ApiMemberListProps {
  members?: readonly {
    name: string;
    kind: string;
    signature: string;
    description: string;
    required: boolean;
    static: boolean;
    readonly: boolean;
    access: string;
    deprecated: boolean | string;
  }[];
}

function ApiMemberList({ members }: ApiMemberListProps): React.JSX.Element {
  if (members === undefined || members.length === 0) return <></>;
  return (
    <div className="vetwo-member-list">
      <table className="vetwo-table vetwo-member-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={i} className={m.deprecated !== false ? "vetwo-deprecated" : ""}>
              <td>
                <code className="vetwo-member-name">
                  {m.static ? "static " : ""}{m.readonly ? "readonly " : ""}{m.name}
                </code>
                {m.access !== "public" && (
                  <span className={\`vetwo-access vetwo-access-\${m.access}\`}>{m.access}</span>
                )}
              </td>
              <td><code className="vetwo-member-kind">{m.kind}</code></td>
              <td>{renderInline(m.description)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render inline code spans (\`x\`) and JSDoc {@link Target} inside text. */
function renderInline(text: string): React.ReactNode[] {
  const withLinks = text.replace(/\\{@link\\s+([^}|]+)(?:\\|[^}]*)?\\}/g, "\`$1\`");
  return withLinks.split(/(\`[^\`]+\`)/g).map((part, i) =>
    part.startsWith("\`") && part.endsWith("\`") && part.length > 2 ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}
`;
}

/** Statically imports every generated page JSON into one record. */
function pagesModule(input: ScaffoldInput): string {
  const imports = input.routes
    .map((route, i) => {
      const varName = `page${i}`;
      const specifier = `../data/pages/${encodeURIComponent(route.slug)}.json`;
      return `import ${varName} from ${JSON.stringify(specifier)};`;
    })
    .join("\n");

  const entries = input.routes
    .map((route, i) => `  ${JSON.stringify(route.slug)}: page${i} as PageData,`)
    .join("\n");

  return `import type { GeneratedPageData } from "./generated-types";

export type PageData = GeneratedPageData;

${imports}

export const allPages: Readonly<Record<string, PageData>> = {
${entries.length > 0 ? `${entries}\n` : ""}};

export function getPage(slug: string): PageData | undefined {
  return allPages[slug];
}

export function getRelated(
  slug: string,
): PageData["related"] {
  return allPages[slug]?.related ?? [];
}
`;
}

/** Site-level data consumed by the layout. */
function docsDataModule(input: ScaffoldInput): string {
  return `import { docsSidebar } from "./sidebar.generated";

export interface DocsData {
  readonly siteName: string;
  readonly description: string;
  readonly sidebar: readonly {
    readonly title: string;
    readonly items: readonly { label: string; href: string }[];
  }[];
}

export const docsData: DocsData = {
  siteName: ${JSON.stringify(input.siteName)},
  description: ${JSON.stringify(input.description ?? "Documentation")},
  sidebar: docsSidebar,
};
`;
}

/** Sidebar tree consumed by the layout. */
function sidebarModule(input: ScaffoldInput): string {
  return `export const docsSidebar = ${JSON.stringify(input.sidebar, null, 2)} as const;
`;
}

/** Shared type declaration file for generated page data. */
export function generatedTypesFile(): RenderedFile {
  return {
    path: "lib/generated-types.ts",
    contents: `export interface GeneratedBreadcrumb {
  label: string;
  href?: string;
}

export interface GeneratedRelatedLink {
  label: string;
  href: string;
  kind?: string;
}

export type GeneratedPageData = {
  schemaVersion: number;
  slug: string;
  title: string;
  description?: string;
  sectionId: string;
  sectionTitle: string;
  breadcrumbs: readonly GeneratedBreadcrumb[];
  blocks: readonly Record<string, unknown>[];
  related: readonly GeneratedRelatedLink[];
};
`,
  };
}

// ─── Styling & meta ──────────────────────────────────────────────────────

/** Generic CSS-variable theme. No framework classes. */
function globalsCss(theme?: RendererTheme): string {
  const colors = theme?.colors ?? {};
  const fonts = theme?.fonts ?? {};
  const bodyFont = fonts.body ?? 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const headingFont = fonts.heading ?? bodyFont;
  const codeFont = fonts.code ?? "ui-monospace, SFMono-Regular, Menlo, monospace";
  return `:root {
  --vetwo-bg: ${colors.background ?? "#ffffff"};
  --vetwo-fg: ${colors.text ?? "#111827"};
  --vetwo-muted: ${colors.muted ?? "#6b7280"};
  --vetwo-border: #e5e7eb;
  --vetwo-accent: ${colors.accent ?? colors.primary ?? "#2563eb"};
  --vetwo-primary: ${colors.primary ?? "#2563eb"};
  --vetwo-secondary: ${colors.secondary ?? "#7c3aed"};
  --vetwo-surface: ${colors.surface ?? "#f9fafb"};
  --vetwo-sidebar-bg: ${colors.surface ?? "#f9fafb"};
  --vetwo-code-bg: #f3f4f6;
  --vetwo-font-body: ${bodyFont};
  --vetwo-font-heading: ${headingFont};
  --vetwo-font-code: ${codeFont};
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --vetwo-bg: #0b0f17;
    --vetwo-fg: #e5e7eb;
    --vetwo-muted: #9ca3af;
    --vetwo-border: #1f2937;
    --vetwo-accent: #60a5fa;
    --vetwo-sidebar-bg: #0f1420;
    --vetwo-code-bg: #111827;
  }
}

body {
  margin: 0;
  background: var(--vetwo-bg);
  color: var(--vetwo-fg);
  font-family: var(--vetwo-font-body);
  line-height: 1.65;
  -webkit-text-size-adjust: 100%;
}
h1, h2, h3, h4 { font-family: var(--vetwo-font-heading); }
code, pre, kbd { font-family: var(--vetwo-font-code); }

/* ─── Site header (brand + external links) ────────────────────────────── */

.vetwo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--vetwo-border);
  background: var(--vetwo-surface);
  position: sticky;
  top: 0;
  z-index: 20;
}
.vetwo-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1rem;
  color: var(--vetwo-fg);
  text-decoration: none;
}
.vetwo-logo { border-radius: 8px; display: block; }
.vetwo-header-nav { display: flex; align-items: center; gap: 0.25rem; }
.vetwo-header-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--vetwo-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
}
.vetwo-header-link:hover { color: var(--vetwo-accent); background: var(--vetwo-code-bg); }
.vetwo-header-icon { display: inline-flex; }

/* ─── Layout shell (shared by Next.js layout and static pages) ──────────── */

.vetwo-layout {
  display: flex;
  align-items: stretch;
  min-height: 100vh;
}
.vetwo-sidebar {
  width: 17.5rem;
  flex: 0 0 17.5rem;
  background: var(--vetwo-sidebar-bg);
  border-right: 1px solid var(--vetwo-border);
  padding: 1.5rem 1.25rem 3rem;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}
.vetwo-sidebar h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
.vetwo-sidebar > p { color: var(--vetwo-muted); font-size: 0.85rem; margin: 0 0 1.25rem; }
.vetwo-main {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 1rem;
  box-sizing: border-box;
}
.vetwo-nav section { margin-bottom: 1.25rem; }
.vetwo-nav h2, .vetwo-sidebar h3 {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vetwo-muted);
  margin: 0 0 0.5rem;
}
.vetwo-nav ul, .vetwo-sidebar ul { list-style: none; margin: 0; padding: 0; }
.vetwo-nav li, .vetwo-sidebar li { margin: 0.15rem 0; }
.vetwo-nav a, .vetwo-sidebar a {
  color: var(--vetwo-fg);
  text-decoration: none;
  font-size: 0.9rem;
  display: block;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}
.vetwo-nav a:hover, .vetwo-sidebar a:hover { background: var(--vetwo-code-bg); color: var(--vetwo-accent); }

/* ─── Typography ────────────────────────────────────────────────────────── */

.vetwo-doc-article { max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.vetwo-doc-article h1 { font-size: 2rem; line-height: 1.25; margin: 0.5rem 0 1rem; letter-spacing: -0.01em; }
.vetwo-doc-article h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--vetwo-border); }
.vetwo-doc-article h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; }
.vetwo-doc-article h4 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
.vetwo-doc-article p { margin: 0.75rem 0; }
.vetwo-doc-article a { color: var(--vetwo-accent); }
.vetwo-doc-article a:hover { text-decoration: underline; }
.vetwo-doc-article hr { border: 0; border-top: 1px solid var(--vetwo-border); margin: 2rem 0; }
.vetwo-doc-section { color: var(--vetwo-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.25rem; }
.vetwo-doc-description { color: var(--vetwo-muted); font-size: 1.05rem; }
.vetwo-breadcrumbs { font-size: 0.85rem; color: var(--vetwo-muted); margin-top: 0.75rem; }
.vetwo-breadcrumbs a { color: var(--vetwo-accent); text-decoration: none; }

.vetwo-blocks pre.vetwo-code {
  background: var(--vetwo-code-bg);
  border: 1px solid var(--vetwo-border);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
}
.vetwo-blocks code { font-family: var(--vetwo-font-code); font-size: 0.875em; }
.vetwo-blocks p > code, .vetwo-blocks li > code { background: var(--vetwo-code-bg); padding: 0.1em 0.35em; border-radius: 4px; }

.vetwo-callout { border-left: 4px solid var(--vetwo-accent); background: var(--vetwo-code-bg); padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; margin: 1rem 0; }
.vetwo-callout-warning, .vetwo-callout-deprecated { border-left-color: #d97706; }

.vetwo-table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
.vetwo-table th, .vetwo-table td { border: 1px solid var(--vetwo-border); padding: 0.5rem 0.75rem; text-align: left; }

.vetwo-related ul { list-style: none; padding: 0; }
.vetwo-related a { color: var(--vetwo-accent); text-decoration: none; }

.vetwo-custom-component {
  border: 1px dashed var(--vetwo-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  color: var(--vetwo-muted);
}

/* ─── API Signature Components ──────────────────────────────────────────── */

.vetwo-api-signature {
  border: 1px solid var(--vetwo-border);
  border-radius: 8px;
  overflow: hidden;
  margin: 1.5rem 0;
}
.vetwo-api-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--vetwo-code-bg);
  border-bottom: 1px solid var(--vetwo-border);
}
.vetwo-api-name { margin: 0; font-size: 1.1rem; }
.vetwo-api-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15em 0.5em;
  border-radius: 4px;
  background: var(--vetwo-accent);
  color: #fff;
}
.vetwo-api-badge-class { background: #7c3aed; }
.vetwo-api-badge-interface { background: #0891b2; }
.vetwo-api-badge-type { background: #d97706; }
.vetwo-api-badge-enum { background: #059669; }
.vetwo-api-badge-function { background: var(--vetwo-accent); }
.vetwo-api-badge-variable, .vetwo-api-badge-constant { background: #6b7280; }
.vetwo-api-deprecated {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.15em 0.5em;
  border-radius: 4px;
  background: #fef3c7;
  color: #92400e;
}
.vetwo-api-code {
  margin: 0;
  padding: 1rem;
  background: var(--vetwo-bg);
  overflow-x: auto;
  font-size: 0.9em;
}

/* ─── Parameter & Type Tables ───────────────────────────────────────────── */

.vetwo-param-section, .vetwo-type-param-section { margin: 1rem 0; }
.vetwo-param-title, .vetwo-type-param-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.vetwo-param-name { color: var(--vetwo-accent); }
.vetwo-param-type { color: var(--vetwo-muted); }
.vetwo-param-default { color: var(--vetwo-muted); font-size: 0.85em; }

/* ─── Type Display ──────────────────────────────────────────────────────── */

.vetwo-type-display {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin: 0.5rem 0;
}
.vetwo-type-label {
  font-weight: 600;
  font-size: 0.9rem;
}
.vetwo-type-value {
  font-size: 0.9em;
}

/* ─── Heritage Display ──────────────────────────────────────────────────── */

.vetwo-heritage {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.75rem 0;
}
.vetwo-heritage-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.vetwo-heritage-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vetwo-muted);
}
.vetwo-heritage-type { font-size: 0.9em; }

/* ─── Member List ───────────────────────────────────────────────────────── */

.vetwo-member-list { margin: 1rem 0; }
.vetwo-member-name { color: var(--vetwo-accent); }
.vetwo-member-kind { color: var(--vetwo-muted); font-size: 0.85em; }
.vetwo-access {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.1em 0.4em;
  border-radius: 3px;
  margin-left: 0.5rem;
}
.vetwo-access-protected { background: #fef3c7; color: #92400e; }
.vetwo-access-private { background: #fee2e2; color: #991b1b; }
.vetwo-deprecated { opacity: 0.6; }

/* ─── Code Block with Title ─────────────────────────────────────────────── */

.vetwo-code-block { margin: 1rem 0; }
.vetwo-code-title {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  background: var(--vetwo-code-bg);
  border: 1px solid var(--vetwo-border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  color: var(--vetwo-muted);
}
.vetwo-code-block .vetwo-code {
  border-radius: 0 0 8px 8px;
}

/* ─── Utility ───────────────────────────────────────────────────────────── */

.vetwo-muted { color: var(--vetwo-muted); }

/* ─── Focus, motion, responsive ─────────────────────────────────────────── */

.vetwo-nav a:focus-visible, .vetwo-sidebar a:focus-visible,
.vetwo-doc-article a:focus-visible, .vetwo-breadcrumbs a:focus-visible {
  outline: 2px solid var(--vetwo-accent);
  outline-offset: 2px;
}
button:focus-visible, summary:focus-visible {
  outline: 2px solid var(--vetwo-accent);
  outline-offset: 2px;
}

@media (max-width: 860px) {
  .vetwo-header { flex-wrap: wrap; padding: 0.75rem 1rem; }
  .vetwo-layout { flex-direction: column; }
  .vetwo-sidebar {
    width: auto;
    flex: none;
    height: auto;
    position: static;
    border-right: 0;
    border-bottom: 1px solid var(--vetwo-border);
    padding: 1rem 1.25rem;
  }
  .vetwo-doc-article { padding: 1.5rem 1rem 3rem; }
  .vetwo-doc-article h1 { font-size: 1.6rem; }
  .vetwo-table { display: block; overflow-x: auto; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
`;
}

function gitignore(): string {
  return ["node_modules/", ".next/", "out/", "next-env.d.ts", ""].join("\n");
}

function readme(input: ScaffoldInput): string {
  return `# ${input.siteName}

Documentation site generated by @vetwo/docs.

\`\`\`bash
npm install
npm run dev     # local development
npm run build   # static export into out/
\`\`\`

Content lives in \`data/pages/*.json\` (structured Documentation IR pages)
and portable Markdown sources in \`content/\`. Regenerate with:

\`\`\`bash
docs render --out .
\`\`\`
`;
}
