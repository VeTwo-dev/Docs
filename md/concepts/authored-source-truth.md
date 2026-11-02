# Authored Source of Truth

The single rule the whole product follows: the generator renders what you write and invents nothing.

## What this means in practice

- Every page, title, date, link, and example in the output traces to a file you authored (or to deterministic derivation from one, like a filename-based title fallback).
- An empty source directory is a build failure (`Static: index.html missing`), not an invitation to fabricate.
- Impossible frontmatter dates (`2026-13-99`) are rejected even though YAML parsing would silently overflow them — the literal you wrote is authoritative.
- Unknown frontmatter keys pass through; only documented keys drive behavior.

## What it does not mean

- Filenames still derive fallback titles; routes still derive from paths; the `/blog` listing is still synthesized from real posts. Derivation from your content is not invention.
- The legacy pipeline (`content.pipeline: "legacy"`) *does* infer from code — that is its documented, opt-in purpose (see [Compatibility](../api/compatibility.md)), not the default.
