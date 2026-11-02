# React Components

`@vetwo/docs/react` (peer `react >= 19`, optional) for rendering documentation inside React/Next.js apps:

- `DocsLayout` — page shell: `title`, `description?`, `nav?`, `sidebar?`, `children`, `theme?: "light" | "dark" | "system"`.
- `MarkdownRenderer` — pipeline HTML: `content`, `className?`.
- `TOC` — table of contents: `headings [{ level, id, text }]`, `maxDepth?`.
- `ThemeToggle` — client button: `defaultTheme?: "light" | "dark"` (use in a `"use client"` component).
- `SearchBox` — search input: `searchUrl?`.

```tsx
import { DocsLayout, MarkdownRenderer, TOC } from "@vetwo/docs/react";

export default function Page({ html, headings }: { html: string; headings: { level: number; id: string; text: string }[] }) {
  return (
    <DocsLayout title="My Docs" theme="system">
      <TOC headings={headings} />
      <MarkdownRenderer content={html} />
    </DocsLayout>
  );
}
```

All names and props verified against the shipped declarations.
