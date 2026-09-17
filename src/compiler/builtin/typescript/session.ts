import type {
  AdapterCompileInput,
  CompilerSession,
  NativeCompilationOutput,
} from "../../contracts/adapter.js";
import { hashContent } from "../../shared/hash.js";
import { compileTypeScriptEntries, type TypeScriptSourceEntry } from "./compile.js";
import { loadTypeScript, scriptKindFor } from "./native.js";

/**
 * An incremental TypeScript session.
 *
 * Caches parsed source files keyed by content hash so unchanged files are
 * never re-parsed. Only changed/added files are parsed on each compile,
 * which keeps large-project rebuilds cheap.
 */
export class TypeScriptSession implements CompilerSession {
  readonly compilerId = "typescript";

  private readonly sources = new Map<string, TypeScriptSourceEntry>();

  constructor(_input: AdapterCompileInput) {}

  /** Removes dropped files and refreshes entries whose content changed. */
  update(changes: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
  }): void {
    for (const file of changes.removed) this.sources.delete(file);
    for (const file of changes.added) this.sources.delete(file);
  }

  async compile(input: AdapterCompileInput): Promise<NativeCompilationOutput> {
    const ts = await loadTypeScript();
    if (ts === undefined) {
      return {
        units: [],
        dependencies: {},
        failedFiles: [...input.files],
        diagnostics: [],
      };
    }
    const entries: TypeScriptSourceEntry[] = [];
    for (const file of input.files) {
      const content = input.contents[file] ?? "";
      const hash = hashContent(content);
      const cached = this.sources.get(file);
      if (cached !== undefined && cached.hash === hash) {
        entries.push(cached);
        continue;
      }
      const entry: TypeScriptSourceEntry = {
        file,
        hash,
        sourceFile: ts.createSourceFile(
          file,
          content,
          ts.ScriptTarget.Latest,
          true,
          scriptKindFor(file, ts),
        ),
      };
      this.sources.set(file, entry);
      entries.push(entry);
    }
    return compileTypeScriptEntries(input, entries, ts);
  }

  dispose(): void {
    this.sources.clear();
  }
}

/** Creates a TypeScript incremental session. */
export function createTypeScriptSession(input: AdapterCompileInput): TypeScriptSession {
  return new TypeScriptSession(input);
}
