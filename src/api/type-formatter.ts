/**
 * TypeScript Type Formatter.
 *
 * Converts `ts.Type` instances into human-readable canonical display strings.
 * Handles unions, intersections, generics, arrays, tuples, function types,
 * conditional types, mapped types, literal types, and object types.
 *
 * Deeply nested types are truncated for readability. Optionally produces
 * cross-reference links for types defined within the project.
 */

import * as ts from "typescript";

/** Maximum depth for recursive type formatting. */
const MAX_DEPTH = 6;

/** Maximum number of union/intersection members before truncation. */
const MAX_MEMBERS = 12;

/** Types that should be displayed as keywords (not expanded). */
const BUILTIN_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "void",
  "null",
  "undefined",
  "never",
  "any",
  "unknown",
  "object",
  "symbol",
  "bigint",
]);

/** Memoization for formatted types: WeakMap<Type, Map<depthKey,string>>  (21.18 lazy formatting) */
const formatCache = new WeakMap<ts.Type, Map<string, string>>();

function cacheKey(depth: number, maxDepth: number): string {
  return `${depth}:${maxDepth}`;
}

/**
 * Format a TypeScript type to a human-readable string.
 *
 * @param type - The TypeScript type to format.
 * @param checker - The TypeScript type checker.
 * @param options - Formatting options.
 * @returns A human-readable type string.
 *
 * @example
 * ```ts
 * const str = formatType(checker.getTypeAtLocation(node), checker);
 * // => "Map<string, number[]>"
 * ```
 */
export function formatType(
  type: ts.Type,
  checker: ts.TypeChecker,
  options: {
    /** Current recursion depth (used internally). */
    depth?: number;
    /** Maximum depth before truncation. */
    maxDepth?: number;
    /** Whether to include cross-reference targets. */
    includeLinks?: boolean;
  } = {},
): string {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;

  if (depth > maxDepth) return "...";

  // 21.18 memoization: top-level calls hit cache; recursive calls also benefit
  const key = cacheKey(depth, maxDepth);
  const cachedMap = formatCache.get(type);
  if (cachedMap !== undefined) {
    const hit = cachedMap.get(key);
    if (hit !== undefined) return hit;
  }

  // Intrinsic types (keyword types)
  const intrinsicName = (type as unknown as { intrinsicName?: string }).intrinsicName;
  if (intrinsicName !== undefined && BUILTIN_TYPES.has(intrinsicName)) {
    return intrinsicName;
  }

  // String literal
  if (type.isStringLiteral()) {
    return JSON.stringify(type.value);
  }

  // Number literal
  if (type.isNumberLiteral()) {
    return String(type.value);
  }

  // BigInt literal
  if (type.flags & ts.TypeFlags.BigIntLiteral) {
    return checker.typeToString(type) + "n";
  }

  // Boolean literal
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return checker.typeToString(type);
  }

  // Null / Undefined
  if (type.flags & ts.TypeFlags.Null) return "null";
  if (type.flags & ts.TypeFlags.Undefined) return "undefined";
  if (type.flags & ts.TypeFlags.Void) return "void";
  if (type.flags & ts.TypeFlags.Never) return "never";
  if (type.flags & ts.TypeFlags.Any) return "any";
  if (type.flags & ts.TypeFlags.Unknown) return "unknown";

  // Union type
  if (type.flags & ts.TypeFlags.Union) {
    const unionType = type as ts.UnionType;
    const types = unionType.types.map((t) =>
      formatType(t, checker, { depth: depth + 1, maxDepth }),
    );
    if (types.length > MAX_MEMBERS) {
      const shown = types.slice(0, MAX_MEMBERS - 1);
      return [...shown, `... (${types.length - shown.length} more)`].join(" | ");
    }
    return types.join(" | ");
  }

  // Intersection type
  if (type.flags & ts.TypeFlags.Intersection) {
    const intersectionType = type as ts.IntersectionType;
    const types = intersectionType.types.map((t) =>
      formatType(t, checker, { depth: depth + 1, maxDepth }),
    );
    if (types.length > MAX_MEMBERS) {
      const shown = types.slice(0, MAX_MEMBERS - 1);
      return [...shown, `... (${types.length - shown.length} more)`].join(" & ");
    }
    return types.join(" & ");
  }

  // Type parameter (generic T)
  if (type.flags & ts.TypeFlags.TypeParameter) {
    return type.symbol?.name ?? checker.typeToString(type);
  }

  // Object type
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;

    // Anonymous type (object literal, inline type)
    if (objectType.flags & ts.ObjectFlags.Anonymous) {
      const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
      if (signatures.length > 0 && signatures[0] !== undefined) {
        return formatSignatureType(signatures[0]!, checker, depth, maxDepth);
      }

      const props = checker.getPropertiesOfType(type);
      if (props.length > 0 && props.length <= 8) {
        const members = props.map((p) => {
          const vd = p.valueDeclaration as ts.Node | undefined;
          if (vd === undefined) return `${p.name}: unknown`;
          const propType = checker.getTypeOfSymbolAtLocation(p, vd!);
          const formatted = formatType(propType, checker, { depth: depth + 1, maxDepth });
          return `${p.name}: ${formatted}`;
        });
        return `{ ${members.join("; ")} }`;
      }
    }

    // Reference type (class, interface, enum, tuple, array, promise, etc.)
    if (objectType.flags & ts.ObjectFlags.Reference) {
      const typeName = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
      return typeName;
    }

    // Index type `{ [key: string]: value }`
    if ((objectType.flags as number) & 0x00000000) {
      // IndexedAccess placeholder
      return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    }

    // Conditional type
    if (
      (objectType.flags as number) &
      ((ts.ObjectFlags as unknown as Record<string, number>)["Conditional"] as number)
    ) {
      return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    }

    // Mapped type
    if (
      (objectType.flags as number) &
      ((ts.ObjectFlags as unknown as Record<string, number>)["Mapped"] as number)
    ) {
      return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    }

    // Fallback for other object types
    return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
  }

  // Fallback: use the checker's built-in formatter
  const result = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
  const m = formatCache.get(type) ?? new Map<string, string>();
  m.set(key, result);
  formatCache.set(type, m);
  return result;
}

/** Format a function/constructor signature type. */
function formatSignatureType(
  signature: ts.Signature,
  checker: ts.TypeChecker,
  depth: number,
  maxDepth: number,
): string {
  const params = signature.getParameters().map((p) => {
    const paramType = checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration!);
    const formatted = formatType(paramType, checker, { depth: depth + 1, maxDepth });
    const isOptional = (p.flags & ts.SymbolFlags.Optional) !== 0;
    return `${p.name}${isOptional ? "?" : ""}: ${formatted}`;
  });

  const returnType = checker.getReturnTypeOfSignature(signature);
  const returnFormatted = formatType(returnType, checker, { depth: depth + 1, maxDepth });

  return `(${params.join(", ")}) => ${returnFormatted}`;
}

/**
 * Format a type to a concise display string suitable for search indexes
 * and navigation labels.
 *
 * @param type - The TypeScript type to format.
 * @param checker - The TypeScript type checker.
 * @returns A concise type string.
 */
export function formatTypeConcise(type: ts.Type, checker: ts.TypeChecker): string {
  const full = formatType(type, checker, { maxDepth: 2 });
  if (full.length > 60) {
    return full.slice(0, 57) + "...";
  }
  return full;
}
