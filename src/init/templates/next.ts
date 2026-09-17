/** Context used to render the Next.js documentation application scaffold. */
export interface NextTemplateContext {
  readonly projectName: string;
}

/** A scaffold file: relative path within the Next.js workspace → content. */
export type ScaffoldFile = [path: string, content: string];

/**
 * Builds the minimal-but-complete Next.js documentation application
 * workspace. Only scaffolding is generated — content and features are left
 * for the renderer/generator to populate later.
 */
export function buildNextScaffold(ctx: NextTemplateContext): readonly ScaffoldFile[] {
  const project = ctx.projectName;
  return [
    [
      "package.json",
      JSON.stringify(
        {
          name: `${slugify(project)}-docs`,
          private: true,
          version: "0.1.0",
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            typecheck: "tsc --noEmit",
          },
          dependencies: {
            next: "^16.2.10",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@types/node": "^20.14.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            typescript: "^5.4.0",
          },
        },
        null,
        2,
      ) + "\n",
    ],
    [
      "tsconfig.json",
      [
        "{",
        '  "compilerOptions": {',
        '    "target": "ES2022",',
        '    "lib": ["dom", "dom.iterable", "esnext"],',
        '    "allowJs": true,',
        '    "skipLibCheck": true,',
        '    "strict": true,',
        '    "noEmit": true,',
        '    "esModuleInterop": true,',
        '    "module": "esnext",',
        '    "moduleResolution": "bundler",',
        '    "resolveJsonModule": true,',
        '    "isolatedModules": true,',
        '    "jsx": "preserve",',
        '    "incremental": true,',
        '    "plugins": [{ "name": "next" }],',
        '    "paths": { "@/*": ["./*"] }',
        "  },",
        '  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],',
        '  "exclude": ["node_modules"]',
        "}",
        "",
      ].join("\n"),
    ],
    [
      "next.config.mjs",
      [
        "/** @type {import('next').NextConfig} */",
        "const nextConfig = {",
        "  reactStrictMode: true,",
        "};",
        "",
        "export default nextConfig;",
        "",
      ].join("\n"),
    ],
    [
      "app/layout.tsx",
      [
        'import type { Metadata } from "next";',
        'import "./globals.css";',
        "",
        `export const metadata: Metadata = {`,
        `  title: "${project} — Documentation",`,
        `  description: "Documentation for ${project}",`,
        "};",
        "",
        "export default function RootLayout({",
        "  children,",
        "}: Readonly<{ children: React.ReactNode }>) {",
        "  return (",
        '    <html lang="en">',
        "      <body>{children}</body>",
        "    </html>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ],
    [
      "app/page.tsx",
      [
        "export default function Home() {",
        "  return (",
        "    <main>",
        "      <h1>Documentation</h1>",
        "      <p>",
        "        This is the Next.js documentation application workspace prepared by",
        "        <code>@vetwo/docs init</code>.",
        "      </p>",
        "      <p>Content lives in <code>content/</code> and <code>md/</code>.</p>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ],
    [
      "app/globals.css",
      [
        "body {",
        "  margin: 0;",
        "  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;",
        "  line-height: 1.6;",
        "  color: #1a202c;",
        "  background: #ffffff;",
        "}",
        "",
        "main {",
        "  max-width: 720px;",
        "  margin: 0 auto;",
        "  padding: 2rem 1.5rem;",
        "}",
        "",
        "code {",
        "  background: #f7fafc;",
        "  padding: 0.15em 0.35em;",
        "  border-radius: 4px;",
        "}",
        "",
      ].join("\n"),
    ],
    [
      "content/README.md",
      [
        "# Content",
        "",
        "Mount canonical documentation content (imported or symlinked from the",
        "Markdown workspace) here for the Next.js application to render.",
        "",
      ].join("\n"),
    ],
    [
      "components/README.md",
      [
        "# Components",
        "",
        "Shared React components for the documentation application (sidebar,",
        "navigation, search, code blocks, ...).",
        "",
      ].join("\n"),
    ],
    [
      "lib/README.md",
      [
        "# Lib",
        "",
        "Shared utilities for the documentation application (content loading,",
        "routing helpers, search wiring, ...).",
        "",
      ].join("\n"),
    ],
    [
      "styles/README.md",
      [
        "# Styles",
        "",
        "Global stylesheets and design tokens for the documentation application.",
        "",
      ].join("\n"),
    ],
    ["public/robots.txt", ["User-agent: *", "Allow: /", ""].join("\n")],
    [
      "README.md",
      [
        `# ${project} — Next.js Documentation Application`,
        "",
        "This workspace was prepared by `@vetwo/docs init`. It is a minimal but",
        "complete Next.js (App Router) documentation application scaffold.",
        "",
        "## Getting started",
        "",
        "```bash",
        "npm install",
        "npm run dev",
        "```",
        "",
        "## Layout",
        "",
        "- `app/` — App Router pages and layouts",
        "- `components/` — shared React components",
        "- `content/` — mounted documentation content",
        "- `lib/` — shared utilities",
        "- `public/` — static assets",
        "- `styles/` — global styles",
        "",
        "Generated files are safe to regenerate with `docs init`; never place",
        "user-authored content in `static/`.",
        "",
      ].join("\n"),
    ],
  ];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
