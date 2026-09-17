/**
 * Internal engine contract for renderers.
 *
 * A renderer transforms content into a target format (e.g. HTML).
 */
export interface RendererContract {
  readonly name: string;
  readonly render: (content: string, data?: Record<string, unknown>) => string;
}
