# Quick Start

The shortest complete path from zero to a generated site. Executed against the shipped package during documentation writing.

## Prerequisites

Node.js 20+ and a package manager. Verify with [Installation](../installation/installing.md) if unsure.

## Steps

1. Create a project folder with a `package.json`, a `docs/` folder, and one page:

```bash
mkdir -p qs/docs && cd qs
npm init -y
cat > docs/index.md <<'EOF'
# Welcome

Home body.
EOF
```

2. Add a minimal config:

```js
// docs.config.mjs
import { defineDocs } from "@vetwo/docs/config";

export default defineDocs({
  title: "Quick Start",
  source: "./docs",
  output: { directory: "./out", layout: { markdown: true, static: true } },
});
```

3. Build:

```bash
npx docs build
```

4. Confirm the outputs: `out/manifest.json` lists `pages: ["index"]` with `_generatedBy: "@vetwo/docs"`, and `out/static/index.html` renders your page. Serve it with `npx docs serve` (defaults: port 3000, serves the configured output).

## What just happened

Discovery found `docs/index.md`, normalization made it the home page (route `/`), the plan derived the static and Markdown targets, and reconciliation inventoried everything in `manifest.json`. Add `guide/start.md` and rebuild — the new route `/guide/start` appears in navigation automatically. Continue with [First Documentation Project](first-documentation-project.md).
