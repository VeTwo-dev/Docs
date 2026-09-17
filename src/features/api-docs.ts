import type { ApiDocEntry, ApiParameter } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Generates API documentation entries by parsing TypeScript source files using TypeDoc.
 * Populates `ctx.apiDocs` with the extracted entries.
 * TypeDoc extracts the raw API information; rendering is handled separately by the pipeline.
 *
 * @param ctx - The mutable build context containing source files and configuration.
 *
 * @example
 * ```ts
 * await generateApiDocs(ctx);
 * ```
 */
export async function generateApiDocs(ctx: BuildContextMutable): Promise<void> {
  const config = ctx.config.api;
  if (!config.enabled) return;

  let tmpDir: string | undefined;
  try {
    const TypeDoc = await import("typedoc");

    const entryPoints = ctx.sourceFiles
      .filter((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))
      .map((f) => f.path);

    if (entryPoints.length === 0) return;

    tmpDir = mkdtempSync(join(tmpdir(), "typedoc-"));
    const tsconfigPath = join(tmpDir, "tsconfig.json");
    writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { target: "ES2020", module: "ESNext", moduleResolution: "node" },
        include: entryPoints,
      }),
    );

    const app = await TypeDoc.Application.bootstrap({
      entryPoints,
      tsconfig: tsconfigPath,
      excludePrivate: true,
      excludeInternal: true,
      skipErrorChecking: true,
    });

    const project = await app.convert();
    if (!project) return;

    const apiDocs: ApiDocEntry[] = [];

    for (const child of project.children ?? []) {
      collectEntries(child, apiDocs);
    }

    (ctx as { apiDocs: ApiDocEntry[] }).apiDocs = apiDocs;
  } catch (error) {
    ctx.warnings.push({
      code: "TYPEDOC_ERROR",
      message: `Failed to generate API docs: ${error instanceof Error ? error.message : String(error)}`,
    });
  } finally {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type TypeDocReflection = import("typedoc").DeclarationReflection;

function collectEntries(reflection: TypeDocReflection, apiDocs: ApiDocEntry[]): void {
  const kind = reflection.kind as number;

  const isModuleOrNamespace = kind === 2 || kind === 4;

  if (isModuleOrNamespace) {
    for (const child of reflection.children ?? []) {
      collectEntries(child, apiDocs);
    }
    return;
  }

  const entry = convertReflection(reflection);
  if (entry) apiDocs.push(entry);
}

function convertReflection(child: TypeDocReflection): ApiDocEntry | undefined {
  const name = child.name;
  if (!name) return undefined;

  const kind = mapTypeDocKind(child.kind);

  const sig = child.signatures?.[0];
  const comment = sig?.comment ?? child.comment;
  const description = comment?.summary.map((p) => p.text).join("") ?? "";
  const signature = sig?.type?.toString() ?? child.type?.toString() ?? "";
  const deprecatedTag = comment?.blockTags?.find((t) => t.tag === "@deprecated");
  const sinceTag = comment?.blockTags?.find((t) => t.tag === "@since");

  const sigParams = sig?.parameters ?? [];
  const parameters: ApiParameter[] = sigParams.map((p) => ({
    name: p.name,
    type: p.type?.toString() ?? "unknown",
    description: p.comment?.summary.map((s) => s.text).join("") ?? "",
    required: !p.flags.isOptional,
    defaultValue: p.defaultValue,
  }));

  return {
    name,
    kind,
    description,
    signature,
    parameters,
    returnType: signature,
    examples: [],
    sourceFile: child.sources?.[0]?.fileName ?? "",
    since: sinceTag?.content?.map((c) => c.text).join("") ?? undefined,
    deprecated: !!deprecatedTag,
    tags: comment?.blockTags?.map((t) => t.tag.replace("@", "")) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
function mapTypeDocKind(kind: import("typedoc").ReflectionKind): ApiDocEntry["kind"] {
  const k = kind as number;
  if (k === 64) return "function";
  if (k === 128) return "class";
  if (k === 256) return "interface";
  if (k === 2097152) return "type";
  if (k === 32) return "variable";
  if (k === 8) return "enum";
  if (k === 2048) return "function";
  if (k === 1024) return "variable";
  return "module";
}
