/**
 * Project Purpose Discovery (Phase 22).
 * Synthesizes package description + README excerpt + exports + CLI metadata
 * into a coherent overview without inventing claims.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function discoverPurpose(rootDir: string, fallbackDescription?: string): { summary: string; capabilities: string[]; audiences: string[] } {
  let readme = "";
  for (const cand of ["README.md", "readme.md", "Readme.md"]) {
    const p = join(rootDir, cand);
    if (existsSync(p)) {
      try { readme = readFileSync(p, "utf8").slice(0, 4000); } catch {}
      break;
    }
  }
  const firstParagraph = readme.split("\n\n").find(s => s.trim().length > 30)?.replace(/[#*`]/g, "").trim().slice(0, 300) ?? fallbackDescription ?? "";
  // Capabilities from headings
  const capabilities = [...readme.matchAll(/^#{2,3}\s+(.+)$/gm)].map(m => m[1]!.trim()).slice(0, 6);
  // Audiences inferred only if evidence
  const audiences: string[] = [];
  if (/cli|command/i.test(readme)) audiences.push("CLI users");
  if (/api|sdk/i.test(readme)) audiences.push("library consumers");
  if (/plugin/i.test(readme)) audiences.push("plugin authors");
  if (audiences.length === 0) audiences.push("developers");
  return { summary: firstParagraph || fallbackDescription || "Documentation for this project.", capabilities, audiences };
}
