import { describe, it, expect } from "vitest";
import { createConfigurationExampleExtractor, detectKeys } from "./index.js";

const extractor = createConfigurationExampleExtractor();

function input(path: string, content: string, extra: Record<string, unknown> = {}) {
  return { path, content, knownSymbols: ["sym"], knownPackages: ["my-pkg"], ...extra };
}

describe("createConfigurationExampleExtractor", () => {
  it("supports recognized config file names", () => {
    for (const name of [
      "tsconfig.json",
      "vite.config.ts",
      ".eslintrc.json",
      ".env",
      "biome.json",
      "docs.config.ts",
    ]) {
      expect(extractor.supports(`src/${name}`)).toBe(true);
    }
  });

  it("rejects other files", () => {
    expect(extractor.supports("src/index.ts")).toBe(false);
    expect(extractor.supports("package.json")).toBe(false);
  });

  it("extracts a typed configuration example", () => {
    const content = '{\n  "compilerOptions": { "strict": true },\n  "include": ["src"]\n}\n';
    const raw = extractor.extract(input("tsconfig.json", content));
    expect(raw).toHaveLength(1);
    expect(raw[0]?.typeHint).toBe("configuration");
    expect(raw[0]?.language).toBe("json");
    expect(raw[0]?.referencedConfiguration).toEqual(["compilerOptions", "include", "strict"]);
    expect(raw[0]?.confidence).toBe(0.9);
  });

  it("extracts nothing from empty bodies", () => {
    expect(extractor.extract(input("tsconfig.json", "   "))).toEqual([]);
  });

  it("detects packages referenced by config bodies", () => {
    const raw = extractor.extract(input("vite.config.ts", 'import plugin from "my-pkg";\n'));
    expect(raw[0]?.referencedPackages).toEqual(["my-pkg"]);
  });

  it("maps language from the file extension", () => {
    expect(extractor.extract(input("vite.config.ts", "x"))[0]?.language).toBe("ts");
    expect(extractor.extract(input("tailwind.config.js", "x"))[0]?.language).toBe("js");
    expect(extractor.extract(input(".env", "FOO=bar"))[0]?.language).toBe("text");
  });

  it("falls back when the description has no known keys", () => {
    const raw = extractor.extract(input("tsconfig.json", '{"extends": "./base.json"}'));
    expect(raw[0]?.description).toContain("extends");
  });
});

describe("detectKeys", () => {
  it("detects known option keys but not lookalikes", () => {
    expect(detectKeys('{ "strict": true, "module": "esnext" }')).toEqual(["strict", "module"]);
    expect(detectKeys('{ "notStrictly": true }')).toEqual([]);
  });

  it("returns empty for content without keys", () => {
    expect(detectKeys("nothing")).toEqual([]);
  });
});
