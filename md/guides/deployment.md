# Deployment

The package generates sites; you host them. It provides no hosting, preview service, or deploy command.

## What to publish

- **Static target**: publish `<output>/static/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel static, nginx, S3+CDN). No server runtime needed; the search page needs HTTP(S) for its `fetch`, not `file://`.
- **Fumadocs target**: inside `<output>/site/`, run `npm install`, then `npm run build` / `npm start` (standard Next.js), and deploy the Next.js app on any Node host or serverless Next platform.
- **Markdown target**: `md/` pages are portable content — commit them, sync them, or feed them to another pipeline.

## Build for production

```bash
npx docs build
```

A successful build exits 0 after passing the validation gate (boundaries, routes, links, assets, CSS, search). A failed build exits nonzero and names the problem — never ship output from a failed build.

## Assumptions to set explicitly

- Set `baseUrl` to the public origin so sitemap and canonical links are correct.
- The generated Fumadocs `package.json` pins its own dependencies — install inside `site/`, not at your project root.
- Rebuild on the deploying machine (or in CI) rather than copying `node_modules` or build caches between machines.
- Keep generated output out of version control unless you deliberately publish from the repo (ignore patterns commonly exclude the output directory; the repo's own skill template also ignores `docs/next/node_modules`, `docs/next/.next`, `docs/next/out`, and `.vetwo/`).
