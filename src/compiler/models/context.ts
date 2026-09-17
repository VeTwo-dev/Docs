import type { CompilerRequestOptions } from "../contracts/request.js";
import type { CompilationContext } from "../results/index.js";

/** Input required to build a {@link CompilationContext}. */
export interface CompilationContextInput {
  readonly requestId: string;
  readonly rootDir: string;
  readonly languageId: string;
  readonly compilerId: string;
  readonly files: readonly string[];
  readonly compiledFiles: readonly string[];
  readonly mode?: "full" | "incremental";
  readonly workspace?: {
    readonly manager?: string;
    readonly packages?: readonly string[];
    readonly monorepo: boolean;
  };
  readonly options?: CompilerRequestOptions;
}

/** Builds an immutable {@link CompilationContext}. */
export function createCompilationContext(input: CompilationContextInput): CompilationContext {
  return Object.freeze({
    requestId: input.requestId,
    rootDir: input.rootDir,
    languageId: input.languageId,
    compilerId: input.compilerId,
    files: Object.freeze([...input.files]),
    compiledFiles: Object.freeze([...input.compiledFiles]),
    mode: input.mode ?? "full",
    ...(input.workspace !== undefined
      ? {
          workspace: Object.freeze({
            ...(input.workspace.manager !== undefined ? { manager: input.workspace.manager } : {}),
            ...(input.workspace.packages !== undefined
              ? { packages: Object.freeze([...input.workspace.packages]) }
              : {}),
            monorepo: input.workspace.monorepo,
          }),
        }
      : {}),
    options: input.options !== undefined ? Object.freeze({ ...input.options }) : {},
  });
}
