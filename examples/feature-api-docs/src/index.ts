/**
 * Creates a new application instance.
 *
 * @param options - Configuration options for the application.
 * @returns A configured App instance.
 *
 * @example
 * ```ts
 * const app = createApp({ port: 3000 });
 * app.listen();
 * ```
 */
export function createApp(options?: AppOptions): App {
  const port = options?.port ?? 3000;
  return {
    port,
    listen: () => console.log(`Listening on port ${port}`),
  };
}

export interface AppOptions {
  port?: number;
  host?: string;
}

export interface App {
  port: number;
  listen: () => void;
}
