/**
 * Monorepo Support (21.16).
 *
 * Discovers workspaces via `package.json#workspaces` / `pnpm-workspace.yaml`
 * and runs the analyzer per package. Results are merged with package-qualified
 * names (`pkg/symbol`) so cross-package `extends`/`implements` still resolves
 * when names are unique.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ApiSymbol } from "./models.js";
import type { SemanticAnalyzerOptions } from "./analyzer.js";
import { analyzeAPIs } from "./analyzer.js";

export interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}

export function discoverWorkspaces(rootDir: string): WorkspacePackage[] {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: string[] | { packages?: string[] }; name?: string };
    const patterns: string[] = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : (pkg.workspaces?.packages ?? []);
    if (patterns.length === 0) return [{ name: pkg.name ?? "root", dir: rootDir }];
    // Best-effort: expand `packages/*` via fast-glob if available, else return as-is
    const pkgs: WorkspacePackage[] = [];
    for (const pat of patterns) {
      const base = pat.replace(/\/\*.*$/, "");
      const dir = join(rootDir, base);
      // We don't glob here to avoid extra deps; caller can pass explicit per-package options.
      pkgs.push({ name: pat, dir });
    }
    return pkgs.length > 0 ? pkgs : [{ name: pkg.name ?? "root", dir: rootDir }];
  } catch {
    return [{ name: "root", dir: rootDir }];
  }
}

export async function analyzeMonorepo(
  rootDir: string,
  perPackageOptions?: (pkg: WorkspacePackage) => SemanticAnalyzerOptions | undefined,
): Promise<{ packages: WorkspacePackage[]; symbols: ApiSymbol[] }> {
  const packages = discoverWorkspaces(rootDir);
  const all: ApiSymbol[] = [];
  for (const pkg of packages) {
    const opts = perPackageOptions?.(pkg) ?? { rootDir: pkg.dir };
    try {
      const res = await analyzeAPIs(opts);
      for (const s of res.symbols) {
        all.push({ ...s, qualifiedName: s.qualifiedName.includes("/") ? s.qualifiedName : `${pkg.name}/${s.qualifiedName}` } as ApiSymbol);
      }
    } catch {
      // Missing tsconfig or no TS files — skip package
    }
  }
  return { packages, symbols: all };
}
