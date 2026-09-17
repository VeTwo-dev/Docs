import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols, detectPackages } from "../normalizers/normalizer.js";

/** Test file naming conventions. */
const TEST_FILE_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.(test|spec)\.[cm]?js$/,
  /__tests__[\\/]/,
];

/** A test case block (`it(...)` / `test(...)`) found in a test file. */
interface TestCase {
  readonly name: string;
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
}

/**
 * Extracts usage evidence from test files.
 *
 * Test cases are valuable evidence but are classified as `test` provenance:
 * the classifier decides whether a given test mirrors production usage. The
 * engine never assumes a whole test is appropriate end-user documentation.
 */
export function createTestExampleExtractor(): ExampleExtractor {
  return {
    id: "tests",
    name: "Test usage extractor",
    provenanceKinds: ["tests"],

    supports(path: string): boolean {
      return TEST_FILE_PATTERNS.some((pattern) => pattern.test(path));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const cases = extractTestCases(input.content);
      const results: RawExample[] = cases.map((testCase) => {
        const body = normalizeExampleBody(testCase.body);
        return {
          title: testCase.name,
          language: languageFor(input.path),
          content: body,
          provenance: provenance(
            "tests",
            input.path,
            { startLine: testCase.startLine, endLine: testCase.endLine },
            testCase.name,
          ),
          description: `Test case: ${testCase.name}`,
          typeHint: "test",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.85,
        };
      });
      return Object.freeze(results);
    },
  };
}

/**
 * Finds `it(...)`, `test(...)`, `test.each` and `describe.each` case bodies.
 * Handles arrow functions and inline callbacks with balanced-brace matching.
 */
export function extractTestCases(content: string): readonly TestCase[] {
  const results: TestCase[] = [];
  const callRe =
    /\b(it|test)(?:\.each)?\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:async\s*)?(?:\(([^)]*)\)\s*=>|\s*\(\s*\)\s*=>|\s*=>|function\s*\([^)]*\))\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(content)) !== null) {
    const name = match[2] ?? "test case";
    const openBraceIndex = match.index + match[0].lastIndexOf("{");
    const body = extractBalancedBlock(content, openBraceIndex);
    if (body === undefined) continue;
    const startLine = content.slice(0, match.index).split("\n").length;
    const endLine = startLine + body.split("\n").length;
    results.push({ name, body, startLine, endLine });
    callRe.lastIndex = openBraceIndex + 1;
  }
  return Object.freeze(results);
}

/** Extract a `{ ... }` block starting at `openBraceIndex`, honoring nesting. */
function extractBalancedBlock(content: string, openBraceIndex: number): string | undefined {
  let depth = 0;
  let inString: "'" | '"' | "`" | undefined;
  let escaped = false;
  for (let i = openBraceIndex; i < content.length; i++) {
    const char = content[i]!;
    if (inString !== undefined) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\" && inString === "`") {
        escaped = true;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === inString) {
        inString = undefined;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      escaped = false;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(openBraceIndex + 1, i);
    }
  }
  return undefined;
}

function languageFor(path: string): string {
  return path.endsWith(".tsx") || path.endsWith(".ts")
    ? "ts"
    : path.endsWith(".jsx")
      ? "jsx"
      : "js";
}
