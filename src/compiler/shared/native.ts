/** Lazily loads a native compiler module, returning `undefined` when absent. */
export async function loadNativeModule(name: string): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import(name)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
