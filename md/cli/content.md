# `docs content` Group

Inspect and validate authored documentation content (no inference):

```text
docs content check                    # quick health check (parse errors only)
docs content lint [--snippets <dir>]  # lint content quality (default snippets: docs/content/snippets)
docs content validate [--components <json>]
                                      # validate MDX components vs registry (default "{}")
docs content conflicts                # show unresolved generated-vs-authored conflicts
docs content diff [slug]              # semantic diff of a page vs last committed snapshot
```

`--components` takes component metadata as JSON (`name → module`). `diff [slug]` scopes the semantic diff to one page; without a slug it covers the content set.

Related: [generate](generate.md) (`--dry-run`/`--force` regeneration), [Markdown Content](../guides/markdown-content.md), [MDX Content](../guides/mdx-content.md).
