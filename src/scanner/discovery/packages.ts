import { basename } from "node:path";
import type { ScannerProvider } from "../providers/types.js";
import { createPackageModel, type PackageModel } from "../models/package.js";
import { createDiagnostic, type DiagnosticModel } from "../models/diagnostics.js";
import { toPosixPath, toRelativePath } from "../utils/path.js";
import { readJsonFile } from "./workspace.js";

/** Options for package discovery. */
export interface PackageDiscoveryOptions {
  /** Emit warnings for workspace directories without a manifest. */
  readonly strict?: boolean;
}

/** The result of package discovery. */
export interface PackageDiscoveryResult {
  readonly packages: readonly PackageModel[];
  readonly diagnostics: readonly DiagnosticModel[];
}

/** Returns a string field from a raw manifest when it is a string. */
function stringField(raw: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" ? value : undefined;
}

/** Returns a string-record field from a raw manifest when it is an object. */
function recordField(
  raw: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, string>> {
  const value = raw[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** Returns a string-array field from a raw manifest when it is an array. */
function arrayField(raw: Readonly<Record<string, unknown>>, key: string): readonly string[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Builds an immutable package model from a raw manifest. */
function buildPackageModel(
  raw: Readonly<Record<string, unknown>>,
  rootDir: string,
  dirAbs: string,
  dirRel: string,
  manifestPath: string,
  isWorkspaceRoot: boolean,
): PackageModel {
  const name =
    stringField(raw, "name") ??
    (isWorkspaceRoot ? basename(dirAbs) : (dirRel.split("/").pop() ?? "unknown"));
  return createPackageModel({
    path: dirAbs,
    relativePath: dirRel,
    name,
    version: stringField(raw, "version"),
    private: raw["private"] === true,
    manifestPath,
    manifestRelativePath: toRelativePath(rootDir, manifestPath),
    isWorkspaceRoot,
    description: stringField(raw, "description"),
    license: stringField(raw, "license"),
    author: stringField(raw, "author"),
    keywords: arrayField(raw, "keywords"),
    scripts: recordField(raw, "scripts"),
    dependencies: recordField(raw, "dependencies"),
    devDependencies: recordField(raw, "devDependencies"),
    peerDependencies: recordField(raw, "peerDependencies"),
    optionalDependencies: recordField(raw, "optionalDependencies"),
    bin: (() => {
      const bin = raw["bin"];
      if (typeof bin === "string") return bin;
      if (typeof bin === "object" && bin !== null) {
        return Object.fromEntries(
          Object.entries(bin as Readonly<Record<string, unknown>>),
        ) as Readonly<Record<string, string>>;
      }
      return undefined;
    })(),
    exports: raw["exports"],
    main: stringField(raw, "main"),
    module: stringField(raw, "module"),
    types: stringField(raw, "types"),
    packageManager: stringField(raw, "packageManager"),
    workspaces: (() => {
      const workspaces = raw["workspaces"];
      if (Array.isArray(workspaces)) {
        return workspaces.filter((entry): entry is string => typeof entry === "string");
      }
      if (typeof workspaces === "object" && workspaces !== null) {
        const packages = (workspaces as Readonly<Record<string, unknown>>)["packages"];
        if (Array.isArray(packages)) {
          return packages.filter((entry): entry is string => typeof entry === "string");
        }
      }
      return undefined;
    })(),
    raw,
  });
}

/**
 * Discovers packages in a project root and its workspace directories.
 *
 * @param provider - The resource provider.
 * @param rootDir - The project root.
 * @param workspaceDirs - Concrete workspace directories (relative paths).
 * @param options - Discovery options.
 * @returns The discovered packages and any diagnostics.
 */
export async function discoverPackages(
  provider: ScannerProvider,
  rootDir: string,
  workspaceDirs: readonly string[],
  options: PackageDiscoveryOptions = {},
): Promise<PackageDiscoveryResult> {
  const packages: PackageModel[] = [];
  const diagnostics: DiagnosticModel[] = [];

  const rootManifest = toPosixPath(`${rootDir}/package.json`);
  if (await provider.isFile(rootManifest)) {
    const raw = await readJsonFile(provider, rootManifest);
    if (raw) {
      packages.push(buildPackageModel(raw, rootDir, rootDir, ".", rootManifest, true));
    } else {
      diagnostics.push(
        createDiagnostic({
          category: "invalid-manifest",
          severity: "warning",
          message: "Root package.json is invalid or unparseable",
          path: rootManifest,
          source: "package-discovery",
        }),
      );
    }
  }

  const seen = new Set<string>(["."]);
  for (const dirRel of workspaceDirs) {
    if (seen.has(dirRel)) {
      diagnostics.push(
        createDiagnostic({
          category: "circular-workspace",
          severity: "warning",
          message: `Workspace directory "${dirRel}" is matched more than once`,
          path: toPosixPath(`${rootDir}/${dirRel}`),
          source: "package-discovery",
        }),
      );
      continue;
    }
    seen.add(dirRel);
    const dirAbs = toPosixPath(`${rootDir}/${dirRel}`);
    const manifest = toPosixPath(`${dirAbs}/package.json`);
    if (await provider.isFile(manifest)) {
      const raw = await readJsonFile(provider, manifest);
      if (raw) {
        packages.push(buildPackageModel(raw, rootDir, dirAbs, dirRel, manifest, false));
      } else {
        diagnostics.push(
          createDiagnostic({
            category: "invalid-manifest",
            severity: "warning",
            message: `package.json in "${dirRel}" is invalid or unparseable`,
            path: manifest,
            source: "package-discovery",
          }),
        );
      }
    } else if (options.strict === true) {
      diagnostics.push(
        createDiagnostic({
          category: "missing-manifest",
          severity: "warning",
          message: `Workspace directory "${dirRel}" has no package.json`,
          path: dirAbs,
          source: "package-discovery",
        }),
      );
    }
  }

  packages.sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );
  return { packages, diagnostics };
}
