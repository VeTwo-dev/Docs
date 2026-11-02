# Next.js + Fumadocs Output

The primary target: a complete, self-contained Fumadocs project emitted under `<output>/site/`.

## Enabling it

```js
export default defineDocs({
  source: "./docs",
  output: {
    directory: "./out",
    layout: { markdown: true, static: true, site: true },
  },
});
```

Run `npx docs build`. The generator writes the project; you install, build, and deploy it yourself — the package automates none of those steps.

## What gets generated

- `package.json` with pinned dependencies (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, `next`, `react`, `react-dom`, `tailwindcss`, `postcss`, `@tailwindcss/postcss`, `graphology`, `sigma`).
- `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `source.config.ts` (Fumadocs MDX wiring).
- `app/layout.tsx` (Tailwind globals included), `app/[[...slug]]/page.tsx`, `app/api/search/route.ts`, `app/graph/page.tsx`.
- `content/docs/**/*.mdx` — one page per IR page, plus `meta.json` navigation files.
- `components/graph-view.tsx`, `mdx-components.tsx`, `lib/source.ts`, `public/graph.json`.

Install and run it like any Next.js app (`npm install`, `npm run build`, `npm start` inside `site/`).

## Ownership boundaries

Only files the generator wrote (manifest inventory + `generator:` markers) are refreshed or reconciled. Your edits inside `site/` to non-generated files, and any files you add, are preserved across rebuilds — but hand-editing generated `content/docs/*.mdx` to fix validation is an anti-pattern: fix the source Markdown and regenerate.

## Routing notes

- The home page is served at `/`; without a literal home document the root redirects deterministically to the plan home.
- The search API route serves the generated records; the static target's search page is a separate self-contained implementation (see [Static HTML Output](static-html-output.md)).
