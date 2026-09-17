/**
 * AI Run Tracking.
 *
 * Tracks metadata for each AI generation run. Persists run metadata
 * under `.vetwo/docs/ai/runs/` for diagnostics and incremental generation.
 */

import type { SafeFileSystem } from "../../init/filesystem/interface.js";
import { posixJoin } from "../../init/filesystem/interface.js";
import type { AIRunMetadata } from "../types.js";
import { atomicWriteJson } from "../../state/atomic.js";

/** Run tracking manager. */
export interface AIRunTracker {
  /** Start a new run. Returns the run ID. */
  startRun(provider: string, model: string): string;
  /** Complete a run with results. */
  completeRun(runId: string, result: Partial<AIRunMetadata>): void;
  /** Get a specific run. */
  getRun(runId: string): AIRunMetadata | undefined;
  /** List all runs (newest first). */
  listRuns(limit?: number): readonly AIRunMetadata[];
  /** Persist runs to disk. */
  persist(fs: SafeFileSystem, stateRoot: string): void;
  /** Load runs from disk. */
  load(fs: SafeFileSystem, stateRoot: string): void;
}

class AIRunTrackerImpl implements AIRunTracker {
  private readonly runs = new Map<string, AIRunMetadata>();

  startRun(provider: string, model: string): string {
    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const run: AIRunMetadata = {
      runId,
      provider,
      model,
      startedAt: new Date().toISOString(),
    };
    this.runs.set(runId, run);
    return runId;
  }

  completeRun(runId: string, result: Partial<AIRunMetadata>): void {
    const existing = this.runs.get(runId);
    if (existing === undefined) return;
    this.runs.set(runId, {
      ...existing,
      ...result,
      completedAt: new Date().toISOString(),
    });
  }

  getRun(runId: string): AIRunMetadata | undefined {
    return this.runs.get(runId);
  }

  listRuns(limit = 50): readonly AIRunMetadata[] {
    return [...this.runs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  persist(fs: SafeFileSystem, stateRoot: string): void {
    const runsDir = posixJoin(stateRoot, "ai", "runs");
    fs.mkdir(runsDir);
    const runsFile = posixJoin(runsDir, "runs.json");
    const data = [...this.runs.values()];
    atomicWriteJson(fs, runsFile, data);
  }

  load(fs: SafeFileSystem, stateRoot: string): void {
    const runsFile = posixJoin(stateRoot, "ai", "runs", "runs.json");
    if (!fs.isFile(runsFile)) return;
    try {
      const data = JSON.parse(fs.readFile(runsFile)) as AIRunMetadata[];
      for (const run of data) {
        this.runs.set(run.runId, run);
      }
    } catch {
      // Corrupted runs file — start fresh
    }
  }
}

/** Create a new run tracker. */
export function createAIRunTracker(): AIRunTracker {
  return new AIRunTrackerImpl();
}
