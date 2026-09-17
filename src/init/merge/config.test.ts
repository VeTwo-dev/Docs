import { describe, it, expect } from "vitest";
import { detectConfigSections, mergeConfigContent } from "./config.js";

const OUTPUT = '  output: {\n    directory: "docs",\n  },';
const AGENT = "  agent: {\n    enabled: true,\n  },";

const DESIRED = { output: OUTPUT, agent: AGENT };

describe("detectConfigSections", () => {
  it("detects output and agent in a full config", () => {
    const source = `export default defineDocs({\n${OUTPUT}\n${AGENT}\n});`;
    expect(detectConfigSections(source)).toEqual({ hasOutput: true, hasAgent: true });
  });

  it("reports missing sections", () => {
    const source = `export default defineDocs({ title: "x" });`;
    expect(detectConfigSections(source)).toEqual({ hasOutput: false, hasAgent: false });
  });
});

describe("mergeConfigContent", () => {
  it("inserts missing output and agent sections", () => {
    const source = `export default defineDocs({\n  title: "x",\n});`;
    const merged = mergeConfigContent(source, DESIRED);
    expect(merged).toContain("output: {");
    expect(merged).toContain("agent: {");
    expect(merged).toContain('title: "x"');
  });

  it("does not duplicate existing sections", () => {
    const source = `export default defineDocs({\n${OUTPUT}\n});`;
    const merged = mergeConfigContent(source, DESIRED);
    expect(merged?.match(/output:/g)).toHaveLength(1);
    expect(merged).toContain("agent: {");
  });

  it("returns undefined when no changes are needed", () => {
    const source = `export default defineDocs({\n${OUTPUT}\n${AGENT}\n});`;
    expect(mergeConfigContent(source, DESIRED)).toBeUndefined();
  });

  it("leaves non-defineDocs files untouched", () => {
    expect(mergeConfigContent("module.exports = {};", DESIRED)).toBeUndefined();
  });

  it("keeps user keys in the merged output", () => {
    const source = `export default defineDocs({\n  title: "My Docs",\n});`;
    const merged = mergeConfigContent(source, DESIRED);
    expect(merged).toContain('title: "My Docs"');
  });
});
