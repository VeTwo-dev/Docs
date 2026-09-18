/**
 * Sample TypeScript file for API analyzer testing.
 *
 * Contains functions, classes, interfaces, enums, type aliases,
 * generics, overloads, and heritage chains.
 */

/** Configuration options for the client. */
export interface ClientOptions {
  /** Base URL for API requests. */
  readonly baseUrl: string;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
  /** Custom headers to include in every request. */
  readonly headers?: Record<string, string>;
}

/** A user in the system. */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
}

/** Extended user with profile information. */
export interface UserProfile extends User {
  readonly bio?: string;
  readonly avatarUrl?: string;
}

/**
 * Creates a new user in the system.
 *
 * @param name - The user's full name
 * @param email - The user's email address
 * @param options - Additional creation options
 * @returns The created user
 * @throws {ValidationError} If the email is invalid
 * @example
 * ```ts
 * const user = await createUser("Alice Smith", "alice@example.com");
 * ```
 * @since 1.0.0
 */
export function createUser(
  name: string,
  email: string,
  options?: { readonly sendWelcome?: boolean },
): Promise<User> {
  if (options?.sendWelcome === true) {
    void options;
  }
  return Promise.resolve({ id: "1", name, email, createdAt: new Date() });
}

/**
 * Searches for users matching the query.
 *
 * @param query - The search query
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching users
 */
export function searchUsers(query: string, limit: number = 10): User[] {
  void query;
  void limit;
  return [];
}

/** @deprecated Use `createUser` instead. */
export function registerUser(name: string, email: string): Promise<User> {
  return createUser(name, email);
}

/**
 * A generic container for paginated results.
 *
 * @typeParam T - The type of items in the page
 */
export class PaginatedList<T> {
  private readonly items: T[];
  private readonly total: number;

  /**
   * Creates a new paginated list.
   *
   * @param items - The items for this page
   * @param total - Total number of items across all pages
   */
  constructor(items: T[], total: number) {
    this.items = items;
    this.total = total;
  }

  /** Returns the items in this page. */
  getItems(): readonly T[] {
    return this.items;
  }

  /** Returns the total number of items. */
  getTotal(): number {
    return this.total;
  }

  /** Whether more pages exist. */
  get hasMore(): boolean {
    return this.items.length < this.total;
  }
}

/**
 * An error thrown when validation fails.
 */
export class ValidationError extends Error {
  /** The field that failed validation. */
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * HTTP methods supported by the client.
 */
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

/** The result of an API operation. */
export type ApiResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: Error };

/** A map of string keys to values. */
export type StringMap = Record<string, string>;

/** The version string. */
export const VERSION = "1.0.0";

/** Maximum number of retries. */
export const MAX_RETRIES = 3;
