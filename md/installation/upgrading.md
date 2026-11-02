# Upgrading

How to move between versions and what compatibility to expect.

## Within 1.x

```bash
npx docs upgrade --check   # report only, change nothing
npx docs upgrade           # install <pkg>@latest for @vetwo/* deps via your PM
```

`upgrade` inspects your `dependencies`/`devDependencies` for `@vetwo/*` (or `vetwo`) packages, compares with the registry, and installs updates. Package names are validated before any install command runs. Within 1.x, public exports, CLI commands, flags, and configuration keys are preserved — including the frozen legacy/intelligence surface (see [Compatibility](../api/compatibility.md)).

## Across majors

A future major may remove the legacy/intelligence surface under a versioned migration plan. That decision is explicitly open: nothing in 1.x is deprecated, renamed, or silently removed to anticipate it. When a major lands, follow its migration guide; until then, treat every documented 1.x surface as supported.

## Downgrading

If a new version misbehaves, pin the previous exact version in your manifest and reinstall. Generated output carries no version gate: reconciliation trusts the `_generatedBy: "@vetwo/docs"` marker plus the manifest inventory, so builds across nearby versions interoperate on the same workspace.
