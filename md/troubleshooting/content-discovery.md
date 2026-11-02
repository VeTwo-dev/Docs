# Content Discovery Failures

- **Pages missing from output**: the file isn't under the configured `source`, has a non-`.md`/`.mdx` extension, or matches an ignore (defaults include `node_modules`, `dist`, `build`, `.git`, `coverage`, `.vetwo`, `fixtures`). Check `source` first — the default is `./src`, not `./docs`.
- **`Duplicate route "…" from A and B`**: two files claim one URL (`guide.md` vs `guide/index.md`, `a.md` vs `a.mdx`). Rename one.
- **Title/date wrong**: title falls back frontmatter → H1 → filename; dates accept only strict `YYYY-MM-DD` literals (YAML-coerced overflows are rejected, yielding no date rather than a wrong one).
- **`Invalid MDX …` with a path**: malformed JSX in that `.mdx` file. Fix the markup; generated files are never the fix location.
- **Empty build (`Static: index.html missing`)**: zero discoverable pages — usually a wrong `source`. Add a root `index.md` home page. The build fails instead of emitting an empty site; that is the intended behavior.
- **Images missing in output**: only referenced assets that exist under the project root are copied; check the path relative to the project, not to the page.
