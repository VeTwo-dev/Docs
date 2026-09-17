import { describe, it, expect } from "vitest";
import { buildConfigContent } from "./config.js";

describe("buildConfigContent", () => {
  const base = {
    outputDirectory: "docs",
    sourceDirectory: "./docs/md",
    layout: { next: true, markdown: true, static: true },
    agentEnabled: true,
    skillPath: "agent/skill.md",
  };

  it("emits the markdown workspace as the content source", () => {
    const content = buildConfigContent(base);
    expect(content).toContain('source: "./docs/md",');
  });

  it("falls back to the workspace directory when markdown layout is disabled", () => {
    const content = buildConfigContent({
      ...base,
      layout: { next: true, markdown: false, static: true },
    });
    expect(content).toContain('source: "docs",');
    expect(content).not.toContain("markdown: true");
  });

  it("emits the output workspace with only enabled layouts", () => {
    const content = buildConfigContent({
      ...base,
      layout: { next: false, markdown: true, static: false },
    });
    expect(content).toContain('directory: "docs",');
    expect(content).toContain("markdown: true,");
    expect(content).not.toContain("next: true");
    expect(content).not.toContain("static: true");
  });

  it("emits the agent workspace", () => {
    const content = buildConfigContent(base);
    expect(content).toContain("agent: {");
    expect(content).toContain("enabled: true,");
    expect(content).toContain('path: "agent/skill.md",');
  });

  it("produces a parseable defineDocs export", () => {
    const content = buildConfigContent(base);
    expect(content).toMatch(/export default defineDocs\(\{[\s\S]*\}\);\s*$/);
  });
});
