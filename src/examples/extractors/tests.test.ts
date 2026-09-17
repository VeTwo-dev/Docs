import { describe, it, expect } from "vitest";
import { extractTestCases, createTestExampleExtractor } from "./index.js";

const TESTS = `import { describe, it, expect } from "vitest";
import { greet } from "./greet";

describe("greet", () => {
  it("greets a user", () => {
    expect(greet("Ada")).toBe("Hello Ada");
  });

  it("handles empty names", () => {
    expect(greet("")).toBe("Hello ");
  });

  test("async behavior", async () => {
    const result = await fetchGreeting("Ada");
    expect(result).toBeDefined();
  });
});
`;

describe("extractTestCases", () => {
  it("finds it/test blocks with bodies", () => {
    const cases = extractTestCases(TESTS);
    expect(cases).toHaveLength(3);
    expect(cases[0]?.name).toBe("greets a user");
    expect(cases[0]?.body).toContain('expect(greet("Ada"))');
  });

  it("reports line numbers", () => {
    const cases = extractTestCases(TESTS);
    expect(cases[0]?.startLine).toBe(5);
  });
});

describe("createTestExampleExtractor", () => {
  const extractor = createTestExampleExtractor();

  it("supports test files only", () => {
    expect(extractor.supports("src/foo.test.ts")).toBe(true);
    expect(extractor.supports("src/foo.spec.js")).toBe(true);
    expect(extractor.supports("src/__tests__/foo.ts")).toBe(true);
    expect(extractor.supports("src/foo.ts")).toBe(false);
  });

  it("marks test provenance and test type hint", () => {
    const raw = extractor.extract({ path: "src/foo.test.ts", content: TESTS });
    expect(raw[0]?.provenance.kind).toBe("tests");
    expect(raw[0]?.typeHint).toBe("test");
    expect(raw[0]?.title).toBe("greets a user");
  });
});
