import type { DocsConfig, OutputLayoutConfig } from "./types.js";

/**
 * Resolves the output directory from a configuration value.
 *
 * `output` may be a plain string (legacy form) or a full output-layout
 * workspace configuration object. This helper normalises both forms so the
 * rest of the pipeline never needs to branch on the shape.
 *
 * @param config - The resolved documentation configuration.
 * @returns The output directory as a plain path string.
 *
 * @example
 * ```ts
 * resolveOutputDirectory(config);
 * // => "docs"
 * ```
 */
export function resolveOutputDirectory(config: Pick<DocsConfig, "output">): string {
  const output = config.output;
  if (typeof output === "string") return output;
  return output.directory;
}

/**
 * Resolves the output-layout workspace configuration.
 *
 * Legacy string output is converted to a fully-enabled default layout so the
 * initialization system can always rely on a structured object.
 *
 * @param config - The resolved documentation configuration.
 * @returns The output-layout configuration.
 *
 * @example
 * ```ts
 * const layout = resolveOutputLayout(config);
 * layout.layout.next; // => true
 * ```
 */
export function resolveOutputLayout(config: Pick<DocsConfig, "output">): OutputLayoutConfig {
  const output = config.output;
  if (typeof output === "string") {
    return { directory: output, layout: { next: true, markdown: true, static: true } };
  }
  return output;
}
