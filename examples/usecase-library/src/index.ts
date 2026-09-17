/**
 * Creates a new API client instance.
 *
 * @param options - Client configuration options.
 * @returns A configured Client instance.
 */
export function createClient(options: ClientOptions): Client {
  return {
    baseUrl: options.baseUrl ?? "https://api.example.com",
    fetch: async (path: string) => {
      const url = `${options.baseUrl}${path}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
      });
      return response.json();
    },
  };
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface Client {
  baseUrl: string;
  fetch: (path: string) => Promise<unknown>;
}
