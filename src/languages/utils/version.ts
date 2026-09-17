/**
 * Dependency-free semver-ish version comparison.
 *
 * Version strings may be `1.2.3`, `1.2.3-beta.1`, `2`, `1.2`, etc. A
 * pre-release version compares lower than its release (`1.0.0-beta < 1.0.0`).
 */

/** Parses the numeric segments of a version string. */
export function parseVersion(version: string): readonly number[] {
  return version
    .split("-")[0]!
    .split(".")
    .map((segment) => parseInt(segment, 10))
    .filter((segment) => !Number.isNaN(segment));
}

function preRelease(version: string): string | undefined {
  const dash = version.indexOf("-");
  return dash >= 0 ? version.slice(dash + 1) : undefined;
}

/** Compares two version strings. Returns negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i += 1) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue !== bValue) return aValue - bValue;
  }
  const aPre = preRelease(a);
  const bPre = preRelease(b);
  if (aPre !== undefined && bPre === undefined) return -1;
  if (aPre === undefined && bPre !== undefined) return 1;
  if (aPre !== undefined && bPre !== undefined) {
    if (aPre !== bPre) return aPre < bPre ? -1 : 1;
  }
  return 0;
}

type VersionOperator = "=" | ">" | ">=" | "<" | "<=" | "^" | "~";

const OPERATORS: readonly VersionOperator[] = [">=", "<=", ">", "<", "^", "~", "="];

/**
 * Whether `version` satisfies a requirement such as `^1.2.0`, `~1.2.0`,
 * `>=1.0.0`, `=1.2.3` or a bare `1.2.3`.
 */
export function satisfiesVersion(version: string, requirement: string): boolean {
  const trimmed = requirement.trim();
  if (!trimmed) return true;
  const operator = OPERATORS.find((op) => trimmed.startsWith(op));
  const rest = (operator !== undefined ? trimmed.slice(operator.length) : trimmed).trim();
  if (!rest) return false;
  if (
    rest
      .split("-")[0]!
      .split(".")
      .some((s) => !/^\d+$/.test(s))
  )
    return false;

  if (operator === undefined || operator === "=") {
    return compareVersions(version, rest) === 0;
  }
  const cmp = compareVersions(version, rest);
  switch (operator) {
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case "^":
      return cmp >= 0 && parseVersion(version)[0] === parseVersion(rest)[0];
    case "~":
      return (
        cmp >= 0 &&
        parseVersion(version)[0] === parseVersion(rest)[0] &&
        parseVersion(version)[1] === parseVersion(rest)[1]
      );
  }
}
