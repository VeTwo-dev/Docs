/** Stable fingerprint of a compile request for cache keys. */
export function fingerprintCompileRequest(
  compilerId: string,
  files: readonly string[],
  options: Readonly<Record<string, unknown>>,
): string {
  const sorted = [...files].sort();
  const stable: unknown = { compilerId, files: sorted, options: sortValue(options) };
  return JSON.stringify(stable);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue).sort();
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
