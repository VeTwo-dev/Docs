# Frequently Asked Questions

Short answers backed by the pages they summarize.

## Do I need TypeScript sources to use this?

No. The default pipeline renders authored Markdown/MDX only. TypeScript matters solely for the legacy inference opt-in.

## Where do I put content, and where does output go?

Content: the configured `source` directory (commonly `./docs`). Output: the configured output directory — set it explicitly (e.g. `./out`) so generated files never land inside your sources. See [Configuration](../configuration/files.md).

## Why did my build fail with no pages?

Almost always a wrong `source` (the default is `./src`, not `./docs`) or zero discoverable files. The build fails instead of emitting an empty site — add a root `index.md` and rebuild. See [Content Discovery](../troubleshooting/content-discovery.md).

## How do Blog, search, and navigation work?

Blog posts live under `blog/` with `date:` frontmatter; a `/blog` listing synthesizes unless you author it. Search builds at generation time (static page included). Navigation derives from content unless `nav`/`sidebar` override. See [Site Model](../concepts/site-model-navigation.md).

## Can the generator overwrite my files?

No. Owned files refresh; everything else — user-authored, unknown, foreign — is preserved by contract. See [Ownership](../concepts/ownership-reconciliation.md).

## What stays working in 1.x?

Everything documented: all 16 subpaths, all CLI commands/flags, all config keys including legacy ones. Removal of the legacy surface would be a separately versioned major decision. See [Compatibility](../api/compatibility.md).
