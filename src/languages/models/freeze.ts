/**
 * Recursively freezes plain objects and arrays in place, returning the same
 * reference. Functions and non-plain values (class instances, primitives) are
 * left untouched. Used to make language models immutable.
 */
export function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value) as T;
  }
  if (value !== null && typeof value === "object" && !("call" in value)) {
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== null && typeof child === "object") deepFreeze(child);
    }
    return Object.freeze(value);
  }
  return value;
}
