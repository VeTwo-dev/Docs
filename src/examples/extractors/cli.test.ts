import { describe, it, expect } from "vitest";
import { parseCliCommand, extractCliBlocks, createCliExampleExtractor } from "./index.js";

describe("parseCliCommand", () => {
  it("parses a command with flags and args", () => {
    const parsed = parseCliCommand("$ my-cli build --watch src/index.ts");
    expect(parsed.command).toBe("my-cli");
    expect(parsed.flags).toContain("--watch");
    expect(parsed.args).toContain("src/index.ts");
  });

  it("strips prompt prefixes", () => {
    expect(parseCliCommand("$ npm install").command).toBe("npm");
    expect(parseCliCommand("# npm install").command).toBe("npm");
  });
});

describe("extractCliBlocks", () => {
  it("finds shell fenced blocks", () => {
    const blocks = extractCliBlocks("```bash\n$ foo bar\n```");
    expect(blocks[0]?.command).toBe("foo");
  });
});

describe("createCliExampleExtractor", () => {
  const extractor = createCliExampleExtractor();

  it("supports shell files and package.json", () => {
    expect(extractor.supports("scripts/build.sh")).toBe(true);
    expect(extractor.supports("package.json", "{}")).toBe(true);
    expect(extractor.supports("src/index.ts")).toBe(false);
  });

  it("extracts scripts from package.json", () => {
    const raw = extractor.extract({
      path: "package.json",
      content: JSON.stringify({ scripts: { build: "tsc -p tsconfig.json", test: "vitest run" } }),
    });
    expect(raw).toHaveLength(2);
    expect(raw[0]?.title).toBe("Script: build");
    expect(raw[0]?.typeHint).toBe("cli");
    expect(raw[0]?.provenance.kind).toBe("cli");
  });

  it("never executes commands", () => {
    const raw = extractor.extract({
      path: "scripts/evil.sh",
      content: "rm -rf /\n",
    });
    expect(raw[0]?.content).toBe("rm -rf /");
  });
});
