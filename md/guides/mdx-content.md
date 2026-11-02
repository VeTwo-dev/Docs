# MDX Content

`.mdx` files go through the same discovery, normalization, and site model as `.md`, with one addition: a safe MDX parse that preserves JSX as data-only custom blocks (never executed). Invalid MDX fails the build loudly with the offending path.

## What works where

- **Markdown output (`.mdx` mode, the default):** unknown JSX passes through into the emitted MDX.
- **Markdown output (`.md` mode, `markdown.extension: ".md"`):** custom blocks degrade deterministically to headings, tables, and code — no raw JSX leaks into plain Markdown.
- **Static HTML:** known API blocks (`ApiSignature`, `ParameterTable`, `TypeDisplay`, and siblings) render as HTML; anything else becomes an HTML comment naming the dropped component — never raw JSX, never silent loss.
- **Fumadocs:** MDX content pages (`content/docs/**/*.mdx`) preserve components for the Fumadocs MDX pipeline.

## Component registry

Custom components can be declared via the `components` config (name → module path) and checked with:

```bash
npx docs content validate --components '{"NewsletterSignup": "./components/NewsletterSignup.js"}'
```

## Constraints

- MDX is parsed, not executed: no imports run, no expressions evaluate at generation time.
- Keep custom JSX simple and self-closing where possible; exotic syntax fails validation instead of rendering half-broken pages.
- `.md` files never interpret JSX-looking text — angle brackets in prose are escaped.
