# Release Process

This document describes the release process for @vetwo/docs.

## Prerequisites

- You must have push access to the repository.
- [Changesets](https://github.com/changesets/changesets) is used for version management.

## How Releases Work

Releases are managed through GitHub Actions. When changes are merged into `main`, the release workflow creates or updates a "Version Packages" pull request that accumulates all pending changesets.

### Step 1: Add a Changeset

Before merging a pull request that changes the public API or user-facing behavior, add a changeset:

```bash
npx changeset
```

Select the affected packages and choose the appropriate version bump:

- **patch** -- Bug fixes, documentation updates, internal improvements
- **minor** -- New features that are backward-compatible
- **major** -- Breaking changes

Write a clear summary of the change. This summary will appear in the changelog.

Changesets are not required for changes that do not affect the published package (CI configuration, test updates, internal refactoring).

### Step 2: Merge to Main

When a pull request with a changeset is merged into `main`, the release workflow:

1. Detects the pending changesets.
2. Creates or updates a "Version Packages" pull request.
3. The pull request shows the proposed version bump and generated changelog entries.

### Step 3: Review and Merge the Version PR

A maintainer reviews the "Version Packages" pull request:

- Verify the version bump is correct (patch, minor, or major).
- Review the changelog entries for accuracy and clarity.
- Ensure CI checks pass.

When merged, the release workflow:

1. Publishes the new version to npm.
2. Creates a GitHub release with the changelog.
3. Tags the commit.

### Step 4: Verify

After the release:

- Check the [npm registry](https://www.npmjs.com/package/@vetwo/docs) to confirm the new version is published.
- Verify the GitHub release exists with the correct changelog.
- Test the new version:

  ```bash
  npx @vetwo/docs@<version> --version
  ```

## Manual Release

To create a release manually:

```bash
# Update versions based on changesets
npx changeset version

# Review the changes
git diff

# Publish to npm
npx changeset publish

# Create git tags
git tag --annotate "@vetwo/docs@$(node -p 'require(\"./package.json\").version')"
```

## Versioning Strategy

@vetwo/docs follows [Semantic Versioning](https://semver.org/):

- **Major** (X.0.0): Breaking changes to the configuration API, CLI interface, or plugin system.
- **Minor** (0.X.0): New features, new CLI commands, new plugin hooks, new configuration options.
- **Patch** (0.0.X): Bug fixes, performance improvements, documentation updates, dependency updates.

## Nightly Releases

Nightly builds may be published from the `main` branch for testing purposes. These are tagged with `-nightly` on npm and are not considered stable.
