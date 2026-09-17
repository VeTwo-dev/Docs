/**
 * Content Health Summary.
 *
 * Compact diagnostics for dev mode — never spams the terminal:
 *   ✓ 132 pages valid
 *   ⚠ 3 issues
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAuthoredDocuments } from "./cli.js";
import { lintContent } from "./lint.js";

export interface ContentHealthSummary {
  readonly pages: number;
  readonly errors: number;
  readonly warnings: number;
  /** Rendered terminal lines (already colored). */
  readonly lines: readonly string[];
}

/** Compute a compact health summary for the project's content directory. */
export function summarizeContentHealth(rootDir: string): ContentHealthSummary {
  const contentDir = join(rootDir, "docs", "content");
  if (!existsSync(contentDir)) {
    return {
      pages: 0,
      errors: 0,
      warnings: 0,
      lines: ["\x1b[2mcontent: no authored content directory\x1b[0m"],
    };
  }

  let docs;
  try {
    docs = loadAuthoredDocuments(contentDir);
  } catch {
    return {
      pages: 0,
      errors: 1,
      warnings: 0,
      lines: ["\x1b[31m✕ content: unreadable content directory\x1b[0m"],
    };
  }

  const diagnostics = lintContent(docs);
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  const lines: string[] = [];
  if (errors === 0 && warnings === 0) {
    lines.push(`\x1b[32m✓\x1b[0m ${docs.length} pages valid`);
  } else {
    if (errors > 0) lines.push(`\x1b[31m✕\x1b[0m ${errors} content error(s)`);
    if (warnings > 0) lines.push(`\x1b[33m⚠\x1b[0m ${warnings} content warning(s)`);
    lines.push(`\x1b[2mrun \`docs content lint\` for details\x1b[0m`);
  }

  return { pages: docs.length, errors, warnings, lines };
}
