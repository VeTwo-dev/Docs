# Prerequisites

What the package needs from your environment. All values verified against `package.json` and the implementation.

## Runtime

- **Node.js 20 or later** (`engines: { node: ">=20" }`). The CLI's `doctor` check additionally reports anything below 18.18 as unsupported.
- **A package manager**: npm, pnpm, yarn, or Bun. The package auto-detects yours from lockfiles (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, `package-lock.json` → npm, else npm) and uses it for `upgrade`, `plugin`, and `theme` install commands.
- **Operating system**: no OS-specific requirements; all paths are handled with POSIX-safe normalization. Generated sites are plain files.

## External tools

None required for the default workflow. Optional, by feature:

- **Git**: only for the `changes --git <ref>` comparison mode and changelog-flavored legacy features; everything else works without a repository.
- **A browser**: only if you pass `dev --open`; otherwise the dev server and `serve` just listen on localhost.
- **Network access**: only for commands that explicitly reach the network (`upgrade` version checks/installs, `plugin`/`theme` installs, `npx`-fetched binaries).

## Project shape

Any directory with (eventually) a `package.json` works — the CLI walks upward to the nearest one to find the project root (`--cwd` overrides). Configuration is optional: without a config file, settings come from the `package.json` `@vetwo/docs` key, then built-in defaults.
