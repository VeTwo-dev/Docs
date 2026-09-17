/**
 * Maps over an array with an async function, returning the results.
 *
 * @param items - The array to map over.
 * @param fn - The async mapping function.
 * @returns A promise resolving to the mapped array.
 *
 * @example
 * ```ts
 * const results = await asyncMap([1, 2, 3], async (n) => n * 2);
 * ```
 */
export async function asyncMap<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  return Promise.all(items.map(fn));
}

/**
 * Filters an array with an async predicate.
 *
 * @param items - The array to filter.
 * @param fn - The async predicate function.
 * @returns A promise resolving to the filtered array.
 *
 * @example
 * ```ts
 * const evens = await asyncFilter([1, 2, 3, 4], async (n) => n % 2 === 0);
 * ```
 */
export async function asyncFilter<T>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<boolean>,
): Promise<readonly T[]> {
  const results = await Promise.all(items.map(fn));
  return items.filter((_, i) => results[i]);
}

/**
 * Iterates over an array with an async function.
 *
 * @param items - The array to iterate over.
 * @param fn - The async function to call for each item.
 *
 * @example
 * ```ts
 * await asyncForEach(files, async (f) => process(f));
 * ```
 */
export async function asyncForEach<T>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  await Promise.all(items.map(fn));
}

/**
 * Reduces an array with an async reducer function.
 *
 * @param items - The array to reduce.
 * @param fn - The async reducer function.
 * @param initial - The initial accumulator value.
 * @returns A promise resolving to the reduced value.
 *
 * @example
 * ```ts
 * const sum = await asyncReduce([1, 2, 3], async (acc, n) => acc + n, 0);
 * ```
 */
export async function asyncReduce<T, R>(
  items: readonly T[],
  fn: (acc: R, item: T, index: number) => Promise<R>,
  initial: R,
): Promise<R> {
  let acc = initial;
  for (let i = 0; i < items.length; i++) {
    acc = await fn(acc, items[i]!, i);
  }
  return acc;
}

/**
 * Splits an array into chunks of the specified size.
 *
 * @param items - The array to chunk.
 * @param size - The maximum size of each chunk.
 * @returns An array of chunks.
 *
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2);
 * // => [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Returns a deduplicated array, preserving the original order of first occurrences.
 *
 * @param items - The array to deduplicate.
 * @returns A new array with unique elements.
 *
 * @example
 * ```ts
 * unique([1, 2, 2, 3]);
 * // => [1, 2, 3]
 * ```
 */
export function unique<T>(items: readonly T[]): readonly T[] {
  return [...new Set(items)];
}

/**
 * Groups array elements by a key derived from each element.
 *
 * @param items - The array to group.
 * @param keyFn - A function that returns the group key for each item.
 * @returns A record mapping keys to arrays of items.
 *
 * @example
 * ```ts
 * groupBy([{ type: "a" }, { type: "b" }, { type: "a" }], (x) => x.type);
 * // => { a: [{ type: "a" }, { type: "a" }], b: [{ type: "b" }] }
 * ```
 */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    const group = groups[key];
    if (group) {
      group.push(item);
    } else {
      groups[key] = [item];
    }
  }
  return groups;
}

/**
 * Creates a debounced version of a function that delays invocation until after
 * `ms` milliseconds have elapsed since the last call.
 *
 * @param fn - The function to debounce.
 * @param ms - The debounce delay in milliseconds.
 * @returns The debounced function.
 *
 * @example
 * ```ts
 * const save = debounce(() => writeFile(path, data), 300);
 * ```
 */
export function debounce<T extends (...args: readonly unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Measures the execution time of a synchronous function.
 *
 * @param fn - The function to measure.
 * @returns An object containing the `result` and the `duration` in milliseconds.
 *
 * @example
 * ```ts
 * const { result, duration } = measureTime(() => heavyOperation());
 * ```
 */
export function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Measures the execution time of an async function.
 *
 * @param fn - The async function to measure.
 * @returns A promise resolving to an object with the `result` and the `duration` in milliseconds.
 *
 * @example
 * ```ts
 * const { result, duration } = await measureTimeAsync(() => fetchData());
 * ```
 */
export async function measureTimeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}
