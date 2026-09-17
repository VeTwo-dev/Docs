/**
 * Configuration options for the application.
 */
export interface Config {
  /** The port to listen on. */
  port: number;
  /** The host to bind to. */
  host: string;
  /** Whether to enable debug mode. */
  debug: boolean;
}

/**
 * A route definition.
 */
export interface Route {
  /** HTTP method. */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** URL path pattern. */
  path: string;
  /** Route handler function. */
  handler: (req: Request) => Response;
}
