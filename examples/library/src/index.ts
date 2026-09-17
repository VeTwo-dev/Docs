export interface GreetOptions {
  name: string;
  excited?: boolean;
}

/**
 * Returns a greeting string for the given name.
 *
 * @param name - The name to greet.
 * @param excited - Whether to use an exclamation mark.
 * @returns A greeting string.
 *
 * @example
 * ```ts
 * greet("Alice");      // "Hello, Alice!"
 * greet("Bob", true);  // "Hello, Bob!"
 * ```
 */
export function greet(name: string, excited = false): string {
  return `Hello, ${name}${excited ? "!" : "."}`;
}

/**
 * Adds two numbers together.
 *
 * @param a - First number.
 * @param b - Second number.
 * @returns The sum of a and b.
 *
 * @example
 * ```ts
 * add(2, 3); // 5
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}
