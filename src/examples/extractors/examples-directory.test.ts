import { describe, it, expect } from "vitest";
import { createExamplesDirectoryExampleExtractor, isExamplesPath } from "./index.js";

const extractor = createExamplesDirectoryExampleExtractor();

function input(path: string, content: string) {
  return { path, content, knownSymbols: ["greet"], knownPackages: ["my-pkg"] };
}

describe("isExamplesPath", () => {
  it("recognizes dedicated example directories", () => {
    expect(isExamplesPath("examples/basic.ts")).toBe(true);
    expect(isExamplesPath("src/samples/use-cases.ts")).toBe(true);
    expect(isExamplesPath("docs/guide.md")).toBe(false);
  });
});

describe("createExamplesDirectoryExampleExtractor", () => {
  it("supports known extensions inside example directories", () => {
    expect(extractor.supports("examples/basic.ts")).toBe(true);
    expect(extractor.supports("examples/setup.json")).toBe(true);
    expect(extractor.supports("examples/README.mdx")).toBe(true);
  });

  it("rejects non-example paths and unsupported extensions", () => {
    expect(extractor.supports("src/main.ts")).toBe(false);
    expect(extractor.supports("examples/logo.png")).toBe(false);
  });

  it("extracts whole-file examples with demo type hint", () => {
    const raw = extractor.extract(input("examples/basic.ts", 'greet("hi");'));
    expect(raw[0]?.typeHint).toBe("demo");
    expect(raw[0]?.provenance.kind).toBe("examples");
    expect(raw[0]?.title).toBe("Example: basic.ts");
    expect(raw[0]?.referencedSymbols).toEqual(["greet"]);
  });

  it("extracts nothing from empty bodies", () => {
    expect(extractor.extract(input("examples/empty.ts", "  \n"))).toEqual([]);
  });

  it("maps languages by extension", () => {
    expect(extractor.extract(input("examples/a.tsx", "x"))[0]?.language).toBe("tsx");
    expect(extractor.extract(input("examples/a.mjs", "x"))[0]?.language).toBe("js");
    expect(extractor.extract(input("examples/a.md", "x"))[0]?.language).toBe("markdown");
    expect(extractor.extract(input("examples/a.svelte", "x"))[0]?.language).toBe("svelte");
    expect(extractor.extract(input("examples/a.vue", "x"))[0]?.language).toBe("vue");
    expect(extractor.extract(input("examples/a.html", "x"))[0]?.language).toBe("html");
  });
});
