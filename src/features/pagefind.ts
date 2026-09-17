import type { BuildContextMutable } from "../types/internal.js";

/**
 * Runs Pagefind indexing on the built output directory.
 * Pagefind is a static search library that indexes HTML files.
 * Must run AFTER the output stage has written HTML files.
 *
 * @param ctx - The mutable build context.
 */
export async function generatePagefindIndex(ctx: BuildContextMutable): Promise<void> {
  try {
    const { execa } = await import("execa");
    const { whichPMRuns } = await import("which-pm-runs");
    const pm = whichPMRuns();
    const exec = pm?.name === "yarn" ? "yarn" : "npx";
    const pagefindPath = `${ctx.outputDir}/_pagefind`;
    await execa(exec, ["pagefind", "--site", ctx.outputDir, "--output-dir", pagefindPath], {
      timeout: 30_000,
      stdio: "pipe",
    });
  } catch {
    // Pagefind not available or indexing failed — fall back to MiniSearch.
    // This is expected when pagefind is not installed.
    console.warn("[vetwo/docs] pagefind not available, falling back to MiniSearch");
  }
}
