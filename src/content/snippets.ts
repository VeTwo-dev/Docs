/**
 * Documentation Snippets.
 *
 * Reusable content fragments with include/reference semantics,
 * parameter substitution, and circular-dependency detection.
 *
 * Usage inside content:
 *   <!-- @vetwo:include installation -->
 *   <!-- @vetwo:snippet name="prerequisites" package="foo" -->
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diagnostic } from "../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";
import type { SnippetUsageKind } from "./types.js";

/** A resolved snippet reference. */
export interface SnippetReference {
  readonly kind: SnippetUsageKind;
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly line: number;
}

/** Result of expanding snippets in a document. */
export interface SnippetExpansion {
  /** Document text with snippet directives replaced by resolved content. */
  readonly text: string;
  readonly diagnostics: readonly DocumentationDiagnostic[];
}

const INCLUDE_PATTERN = /<!--\s*@vetwo:include\s+([\w./-]+)\s*-->/g;
const SNIPPET_PATTERN = /<!--\s*@vetwo:snippet\s+name="([\w./-]+)"\s*((?:[\w-]+="[^"]*"\s*)*)-->/g;
const PARAM_PATTERN = /([\w-]+)="([^"]*)"/g;

/**
 * Expand snippet directives in a document.
 *
 * @param files resolver maps a snippet name to its raw source text
 * @throws never — problems become DOC_CONTENT_CYCLE / broken-reference diagnostics
 */
export function expandSnippets(
  text: string,
  resolveFile: (name: string) => string | undefined,
): SnippetExpansion {
  const diagnostics: DocumentationDiagnostic[] = [];
  const visited = new Set<string>();

  const expand = (input: string, depth: number): string => {
    if (depth > 16) {
      return input; // hard depth guard (belt & braces vs cycle detection)
    }

    let output = input;

    // Named includes.
    output = output.replace(INCLUDE_PATTERN, (_match, name: string) => {
      if (visited.has(name)) {
        diagnostics.push(
          diagnostic(
            "DOC_CONTENT_CYCLE",
            "error",
            `Circular snippet include detected involving "${name}".`,
            undefined,
            "Break the include cycle between snippet files.",
          ),
        );
        return "";
      }
      const source = resolveFile(name);
      if (source === undefined) {
        diagnostics.push(diagnostic("DOC_BROKEN_LINK", "error", `Snippet "${name}" not found.`));
        return "";
      }
      visited.add(name);
      const expanded = expand(source, depth + 1);
      visited.delete(name);
      return expanded;
    });

    // Parameterized snippets.
    output = output.replace(SNIPPET_PATTERN, (_match, name: string, rawParams: string) => {
      if (visited.has(name)) {
        diagnostics.push(
          diagnostic(
            "DOC_CONTENT_CYCLE",
            "error",
            `Circular snippet include detected involving "${name}".`,
          ),
        );
        return "";
      }
      const params: Record<string, string> = {};
      for (const paramMatch of rawParams.matchAll(PARAM_PATTERN)) {
        if (paramMatch[1] !== undefined && paramMatch[2] !== undefined) {
          params[paramMatch[1]] = paramMatch[2];
        }
      }
      const source = resolveFile(name);
      if (source === undefined) {
        diagnostics.push(diagnostic("DOC_BROKEN_LINK", "error", `Snippet "${name}" not found.`));
        return "";
      }
      // Substitute {{param}} placeholders — data templating only.
      const substituted = source.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => params[key] ?? "");
      visited.add(name);
      const expanded = expand(substituted, depth + 1);
      visited.delete(name);
      return expanded;
    });

    return output;
  };

  return { text: expand(text, 0), diagnostics };
}

/** Filesystem-based snippet resolver factory. */
export function createFileSnippetResolver(
  snippetsDir: string,
): (name: string) => string | undefined {
  return (name: string): string | undefined => {
    for (const ext of [".mdx", ".md", ""]) {
      try {
        const path = join(snippetsDir, `${name}${ext}`);
        return readFileSync(path, "utf-8");
      } catch {
        continue;
      }
    }
    return undefined;
  };
}
