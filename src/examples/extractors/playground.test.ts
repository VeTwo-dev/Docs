import { describe, it, expect } from "vitest";
import { createPlaygroundExampleExtractor, isPlaygroundPath } from "./index.js";

const extractor = createPlaygroundExampleExtractor();

function input(path: string, content: string) {
  return { path, content, knownSymbols: ["greet"], knownPackages: ["my-pkg"] };
}

describe("isPlaygroundPath", () => {
  it("recognizes play areas", () => {
    expect(isPlaygroundPath("playground/demo.ts")).toBe(true);
    expect(isPlaygroundPath("sandbox/scratch.ts")).toBe(true);
    expect(isPlaygroundPath("src/demos/a.ts")).toBe(true);
    expect(isPlaygroundPath("src/main.ts")).toBe(false);
  });
});

describe("createPlaygroundExampleExtractor", () => {
  it("supports source files inside play areas", () => {
    expect(extractor.supports("playground/demo.ts")).toBe(true);
    expect(extractor.supports("sandbox/a.svelte")).toBe(true);
    expect(extractor.supports("playground/data.json")).toBe(false);
    expect(extractor.supports("src/main.ts")).toBe(false);
  });

  it("extracts demo examples with playground provenance", () => {
    const raw = extractor.extract(input("playground/demo.ts", 'greet("hi");'));
    expect(raw[0]?.typeHint).toBe("demo");
    expect(raw[0]?.provenance.kind).toBe("playground");
    expect(raw[0]?.confidence).toBe(0.8);
    expect(raw[0]?.title).toContain("demo.ts");
  });

  it("extracts nothing from empty bodies", () => {
    expect(extractor.extract(input("playground/empty.ts", " "))).toEqual([]);
  });

  it("maps languages by extension", () => {
    expect(extractor.extract(input("playground/a.ts", "x"))[0]?.language).toBe("ts");
    expect(extractor.extract(input("playground/a.vue", "x"))[0]?.language).toBe("vue");
    expect(extractor.extract(input("scratch/a.mjs", "x"))[0]?.language).toBe("js");
  });
});
