# Content Discovery

How source files become documents. Discovery is purely file-based, explicitly rooted, deterministically ordered, and independent of source-code analysis.

## Rules

- Roots: the configured `source` directory, resolved against the project root (never the calling directory).
- Patterns: `**/*.md` and `**/*.mdx` only.
- Ignored always: `node_modules`, `dist`, `build`, `.git`, `.turbo`, `coverage`, `.vetwo`, `.docs-cache`, `fixtures`, plus your `ignore` list. The `generated/` directory is never a source.
- Ordering: content-root-relative path sort — identical input order on every machine.
- Failures: unreadable files and invalid MDX fail loudly with the offending path.

## Consequences

- Moving a file renames its route; deleting one removes its page (and the next build reconciles the stale output).
- Non-Markdown files in the source tree are ignored silently — images work only as referenced assets, not as pages.
- Discovery reads files; it never writes, moves, or renames them.

Related: [Markdown Content](../guides/markdown-content.md), [Migrating Existing Content](../guides/migrating-existing-content.md).
