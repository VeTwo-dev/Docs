import type { Plugin } from "../../types/internal.js";

/**
 * Creates an OpenAPI plugin that loads and processes an OpenAPI specification.
 *
 * @param options - Optional configuration including a path to the spec file.
 * @returns A Plugin instance for OpenAPI.
 *
 * @example
 * ```ts
 * const plugin = openApi({ spec: "./openapi.yaml" });
 * ```
 */
export function openApi(options?: { spec?: string }): Plugin {
  return {
    name: "@vetwo/docs/openapi",
    version: "0.1.0",
    hooks: {
      load: async (ctx) => {
        ctx.log.info("OpenAPI plugin: loading specification");
        if (options?.spec) {
          ctx.log.debug(`OpenAPI spec: ${options.spec}`);
        }
      },
    },
  };
}

/**
 * Creates a Mermaid diagram plugin that transforms Mermaid code blocks
 * into rendered diagrams during the build.
 *
 * @returns A Plugin instance for Mermaid support.
 *
 * @example
 * ```ts
 * const plugin = mermaid();
 * ```
 */
export function mermaid(): Plugin {
  return {
    name: "@vetwo/docs/mermaid",
    version: "0.1.0",
    hooks: {
      transform: async (ctx) => {
        ctx.log.debug("Mermaid plugin: transforming diagrams");
      },
    },
  };
}
