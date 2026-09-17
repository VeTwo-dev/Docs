import { describe, it, expect } from "vitest";
import { classifyRawExample } from "./index.js";
import type { RawExample } from "../extractors/index.js";

function raw(overrides: Partial<RawExample> = {}): RawExample {
  return {
    title: "t",
    language: "ts",
    content: "const x = 1;",
    provenance: {
      kind: "docs",
      source: "docs/guide.md",
    },
    ...overrides,
  };
}

describe("classifyRawExample", () => {
  it("honors the extractor type hint", () => {
    expect(classifyRawExample(raw({ typeHint: "cli" })).type).toBe("cli");
    expect(classifyRawExample(raw({ typeHint: "demo" })).type).toBe("demo");
  });

  it("maps provenance kinds to default types", () => {
    expect(
      classifyRawExample(raw({ provenance: { kind: "tests", source: "a.test.ts" } })).type,
    ).toBe("test");
    expect(
      classifyRawExample(raw({ provenance: { kind: "storybook", source: "a.stories.tsx" } })).type,
    ).toBe("demo");
    expect(
      classifyRawExample(raw({ provenance: { kind: "configuration", source: "tsconfig.json" } }))
        .type,
    ).toBe("configuration");
    expect(
      classifyRawExample(raw({ provenance: { kind: "fixtures", source: "__fixtures__/x.json" } }))
        .type,
    ).toBe("fixture");
    expect(
      classifyRawExample(raw({ provenance: { kind: "examples", source: "examples/basic.ts" } }))
        .type,
    ).toBe("demo");
  });

  it("defaults unknown provenance to snippet", () => {
    const classified = classifyRawExample(
      raw({ provenance: { kind: "readme", source: "README.md" } }),
    );
    expect(classified.type).toBe("snippet");
  });

  it("derives user-facing flags from provenance", () => {
    const readme = classifyRawExample(raw({ provenance: { kind: "readme", source: "README.md" } }));
    expect(readme.flags.userFacing).toBe(true);

    const test = classifyRawExample(raw({ provenance: { kind: "tests", source: "a.test.ts" } }));
    expect(test.flags.internalOnly).toBe(true);
    expect(test.flags.productionLike).toBe(false);

    const examples = classifyRawExample(
      raw({ provenance: { kind: "examples", source: "examples/a.ts" } }),
    );
    expect(examples.flags.productionLike).toBe(true);
  });

  it("detects frameworks from referenced packages", () => {
    const classified = classifyRawExample(raw({ referencedPackages: ["react"], typeHint: "demo" }));
    expect(classified.framework).toBe("react");
  });

  it("honors explicit framework hints and scoped packages", () => {
    const explicit = classifyRawExample(raw({ framework: "vue", typeHint: "demo" }));
    expect(explicit.framework).toBe("vue");

    const scoped = classifyRawExample(raw({ referencedPackages: ["@angular/core"] }));
    expect(scoped.framework).toBe("@angular/core");
  });

  it("records reasons for explainability", () => {
    const classified = classifyRawExample(raw({ typeHint: "cli" }));
    expect(classified.reasons.length).toBeGreaterThan(0);
  });
});
