import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Classifies package.json dependencies into runtime, peer, dev and important sets.
 *
 * @param rootDir - Project root containing package.json.
 * @returns Classified dependency names.
 */
export function classifyDependencies(rootDir: string): {
  runtime: string[];
  peer: string[];
  dev: string[];
  important: { name: string; reason: string }[];
} {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  } catch {
    // Best-effort discovery — ignore unreadable entries.
  }
  const runtime = Object.keys((pkg["dependencies"] as Record<string, string> | undefined) ?? {});
  const peer = Object.keys((pkg["peerDependencies"] as Record<string, string> | undefined) ?? {});
  const dev = Object.keys((pkg["devDependencies"] as Record<string, string> | undefined) ?? {});
  const important = runtime
    .filter((n) => ["typescript", "react", "next", "vite", "express", "zod"].includes(n))
    .map((n) => ({ name: n, reason: "Core runtime/build dependency" }));
  return { runtime, peer, dev, important };
}
