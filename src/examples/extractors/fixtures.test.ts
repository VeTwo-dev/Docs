import { describe, it, expect } from "vitest";
import { createFixtureExampleExtractor, isFixturePath } from "./index.js";

const extractor = createFixtureExampleExtractor();

function input(path: string, content: string) {
  return { path, content, knownSymbols: ["greet"], knownPackages: ["my-pkg"] };
}

describe("isFixturePath", () => {
  it("recognizes fixture directories", () => {
    expect(isFixturePath("__fixtures__/data.json")).toBe(true);
    expect(isFixturePath("testdata/input.ts")).toBe(true);
    expect(isFixturePath("src/fixtures/a.json")).toBe(true);
    expect(isFixturePath("src/main.ts")).toBe(false);
  });
});

describe("createFixtureExampleExtractor", () => {
  it("supports fixture files with known extensions", () => {
    expect(extractor.supports("__fixtures__/data.json")).toBe(true);
    expect(extractor.supports("testdata/input.yaml")).toBe(true);
    expect(extractor.supports("__snapshots__/x.snap.ts")).toBe(true);
    expect(extractor.supports("__fixtures__/logo.png")).toBe(false);
    expect(extractor.supports("src/main.ts")).toBe(false);
  });

  it("extracts fixture examples with explicit provenance", () => {
    const raw = extractor.extract(input("__fixtures__/user.json", '{"name":"ada"}'));
    expect(raw[0]?.typeHint).toBe("fixture");
    expect(raw[0]?.provenance.kind).toBe("fixtures");
    expect(raw[0]?.confidence).toBe(0.85);
    expect(raw[0]?.title).toContain("user.json");
  });

  it("extracts nothing from empty bodies", () => {
    expect(extractor.extract(input("__fixtures__/empty.json", " "))).toEqual([]);
  });

  it("detects symbols and packages inside fixture content", () => {
    const raw = extractor.extract(input("fixtures/call.ts", 'greet("x"); import "my-pkg";'));
    expect(raw[0]?.referencedSymbols).toEqual(["greet"]);
    expect(raw[0]?.referencedPackages).toEqual(["my-pkg"]);
  });

  it("maps languages by extension", () => {
    expect(extractor.extract(input("fixtures/a.ts", "x"))[0]?.language).toBe("ts");
    expect(extractor.extract(input("fixtures/a.jsx", "x"))[0]?.language).toBe("jsx");
    expect(extractor.extract(input("fixtures/a.toml", "x"))[0]?.language).toBe("toml");
    expect(extractor.extract(input("fixtures/a.md", "x"))[0]?.language).toBe("markdown");
  });
});
