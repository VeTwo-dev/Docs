/**
 * Change Graph.
 *
 * The dependency chain File → Symbol → Module → Knowledge Node →
 * Documentation Page → Output Artifact, persisted under
 * `.vetwo/docs/graph/incremental.json` so impact analysis survives
 * between builds.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ArtifactEntry } from "./snapshot.js";

export const CHANGE_GRAPH_SCHEMA_VERSION = 1;

/** Bidirectional adjacency over node ids (`file:<path>`, `page:<slug>`, `artifact:<id>`). */
export interface ChangeGraph {
  readonly schemaVersion: typeof CHANGE_GRAPH_SCHEMA_VERSION;
  /** node → nodes it depends on (upstream). */
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  /** node → nodes that depend on it (downstream). */
  readonly dependents: Readonly<Record<string, readonly string[]>>;
}

/** Build a change graph from artifact dependency entries. */
export function buildChangeGraph(artifacts: Readonly<Record<string, ArtifactEntry>>): ChangeGraph {
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};

  const link = (artifactId: string, dep: string): void => {
    (dependencies[artifactId] ??= []).push(dep);
    (dependents[dep] ??= []).push(artifactId);
  };

  for (const [id, entry] of Object.entries(artifacts)) {
    const artifactNode = `artifact:${entry.kind}:${id}`;
    for (const file of entry.dependsOnFiles) {
      link(artifactNode, `file:${file}`);
    }
    // Symbols bridge files→pages; symbol edges point at their source files
    // via the snapshot's exports map — modeled as symbol nodes here.
    for (const symbol of entry.dependsOnSymbols) {
      link(artifactNode, `symbol:${symbol}`);
    }
  }

  return { schemaVersion: CHANGE_GRAPH_SCHEMA_VERSION, dependencies, dependents };
}

/**
 * Propagate impact from seed nodes through dependents (BFS).
 * Returns all affected nodes excluding the seeds themselves.
 */
export function propagateImpact(
  graph: ChangeGraph,
  seeds: readonly string[],
): readonly string[] {
  const affected = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) continue;
    for (const dependent of graph.dependents[node] ?? []) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return [...affected];
}

// ─── Persistence ─────────────────────────────────────────────────────────

export function graphPath(rootDir: string): string {
  return join(rootDir, ".vetwo", "docs", "graph", "incremental.json");
}

export function saveChangeGraph(rootDir: string, graph: ChangeGraph): void {
  const path = graphPath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${Date.now().toString(36)}`;
  writeFileSync(tmp, JSON.stringify(graph), "utf-8");
  renameSync(tmp, path);
}

export function loadChangeGraph(rootDir: string): ChangeGraph | undefined {
  const path = graphPath(rootDir);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as ChangeGraph;
    if (raw.schemaVersion !== CHANGE_GRAPH_SCHEMA_VERSION) return undefined;
    return raw;
  } catch {
    return undefined; // corrupted → rebuild
  }
}
