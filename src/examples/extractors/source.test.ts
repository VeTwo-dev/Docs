import { describe, it, expect } from "vitest";
import { extractDocExamples, createSourceExampleExtractor } from "./index.js";

const SOURCE = `/**
 * Greets a user.
 *
 * @example
 * \`\`\`ts
 * import { greet } from "./greet";
 * greet("Ada");
 * \`\`\`
 */
export function greet(name: string): string {
  return \`Hello \${name}\`;
}

/**
 * Sums numbers.
 *
 * @example
 * sum(1, 2, 3); // 6
 */
export function sum(...values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
`;

describe("extractDocExamples", () => {
  it("extracts fenced @example blocks", () => {
    const examples = extractDocExamples(SOURCE);
    expect(examples).toHaveLength(2);
    expect(examples[0]?.language).toBe("ts");
    expect(examples[0]?.content).toContain("import { greet }");
  });

  it("extracts indented plain @example blocks", () => {
    const examples = extractDocExamples(SOURCE);
    expect(examples[1]?.content).toContain("sum(1, 2, 3); // 6");
  });

  it("records line numbers of the example body", () => {
    const examples = extractDocExamples(SOURCE);
    expect(examples[0]?.startLine).toBe(6);
    expect(examples[1]?.startLine).toBe(18);
  });
});

describe("createSourceExampleExtractor", () => {
  const extractor = createSourceExampleExtractor();

  it("supports source files only", () => {
    expect(extractor.supports("src/index.ts")).toBe(true);
    expect(extractor.supports("src/component.tsx")).toBe(true);
    expect(extractor.supports("README.md")).toBe(false);
  });

  it("produces source provenance with typeHint snippet", () => {
    const raw = extractor.extract({ path: "src/greet.ts", content: SOURCE });
    expect(raw[0]?.provenance.kind).toBe("source");
    expect(raw[0]?.typeHint).toBe("snippet");
  });
});
