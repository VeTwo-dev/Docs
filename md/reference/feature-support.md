# Feature Support Matrix

Truthful map of what the product does, generated from implementation evidence (not aspirations).

| Capability | Status | Evidence |
|---|---|---|
| Markdown/MDX authoring → site | Supported (default) | Canonical pipeline; live scratch build |
| Next.js + Fumadocs output | Supported (primary) | Scaffold emits runnable project; pinned manifest |
| Static HTML output | Supported (secondary) | Live build: pages, CSS, search UI, relative links |
| Markdown/MDX output artifacts | Supported | `md/` + `generated/` artifacts with markers |
| Blog (dated posts, listing) | Supported | Model orders, synthesizes `/blog`, live build |
| Build-time + client search | Supported | `search-index.json`, static search page, Fumadocs route |
| Navigation (auto + explicit) | Supported | Derived tree; `nav`/`sidebar` overrides |
| Ownership + reconciliation | Supported | Manifest gate, orphan sweep, preservation tests |
| Path containment/serving guards | Supported | `isPathWithinRoot`, writer bounds, 403/404/400 |
| Plugins + hooks | Supported | Registry, built-ins, lifecycle hooks |
| Themes + tokens + React components | Supported | Token module, 3 themes, 5 components |
| Dev server + watch + serve | Supported | Live reload, debounce, no-write serve |
| `doctor` diagnostics | Supported | Ordered checks, blocking/advisory exits |
| Legacy TS inference (`legacy` pipeline, `analyze`/`plan`/…) | Supported, frozen | Dedicated e2e + self-docs build |
| AI providers/integrations/incremental CLIs | Retained, explicit-use only | Registered commands; nothing runs by default |
| RSS/sitemap/robots/OG artifacts | Legacy-pipeline outputs | Feature writers; not canonical outputs |
| `watch`/`clean`/`include`/remark/rehype config keys | Accepted, inert in 1.0.0 | No runtime consumers; CLI equivalents exist |
| Symlink-aware containment | **Not implemented** | Lexical checks only; stated limitation |
| Hosted preview/deploy service | **Not a feature** | Package generates; you host |
| CMS/AI-generation behavior | **Out of scope** | No such runtime exists |

Anything not on this table is undocumented — ask for evidence before assuming support.
