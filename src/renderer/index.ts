/** A renderer that transforms content into a target format. */
export interface Renderer {
  readonly name: string;
  readonly render: (content: string, data?: Record<string, unknown>) => string;
}

/**
 * Creates a simple HTML pass-through renderer.
 *
 * @returns A Renderer instance with the name `"html"`.
 *
 * @example
 * ```ts
 * const renderer = createHtmlRenderer();
 * const output = renderer.render("<h1>Hello</h1>");
 * ```
 */
export function createHtmlRenderer(): Renderer {
  return {
    name: "html",
    render: (content) => content,
  };
}

export { createDefaultTemplate } from "./template.js";
