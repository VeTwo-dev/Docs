import { deepFreeze } from "../../languages/models/freeze.js";

/** Freezes a record, returning a frozen copy. */
export function freezeRecord<T>(input: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return deepFreeze({ ...input });
}
