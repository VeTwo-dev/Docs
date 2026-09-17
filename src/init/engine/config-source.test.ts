import { describe, it, expect } from "vitest";
import { extractWorkspaceConfig } from "./config-source.js";

describe("extractWorkspaceConfig", () => {
  it("extracts from the generated TS config shape", () => {
    const source = `export default defineDocs({
  source: "./docs/md",
  output: {
    directory: "docs",
    layout: { next: true, markdown: true, static: true },
  },
  agent: {
    enabled: true,
    skill: { path: "agent/skill.md" },
  },
});`;
    const result = extractWorkspaceConfig(source, ".ts");
    expect(result.outputDirectory).toBe("docs");
    expect(result.layout).toEqual({ next: true, markdown: true, static: true });
    expect(result.agentEnabled).toBe(true);
    expect(result.skillPath).toBe("agent/skill.md");
  });

  it("extracts from legacy string output", () => {
    const source = `export default defineDocs({ output: "./docs-site" });`;
    const result = extractWorkspaceConfig(source, ".ts");
    expect(result.outputDirectory).toBe("./docs-site");
    expect(result.layout).toBeUndefined();
  });

  it("extracts from JSON", () => {
    const source = JSON.stringify({
      output: { directory: "wiki", layout: { next: true, markdown: false, static: false } },
      agent: { enabled: false, skill: { path: "custom/skill.md" } },
    });
    const result = extractWorkspaceConfig(source, ".json");
    expect(result.outputDirectory).toBe("wiki");
    expect(result.layout?.next).toBe(true);
    expect(result.layout?.markdown).toBe(false);
    expect(result.agentEnabled).toBe(false);
    expect(result.skillPath).toBe("custom/skill.md");
  });

  it("extracts from YAML", () => {
    const source = [
      "output:",
      "  directory: wiki",
      "  layout:",
      "    next: true",
      "    markdown: true",
      "    static: true",
      "agent:",
      "  enabled: true",
      "  skill:",
      '    path: "agent/skill.md"',
      "",
    ].join("\n");
    const result = extractWorkspaceConfig(source, ".yaml");
    expect(result.outputDirectory).toBe("wiki");
    expect(result.layout).toEqual({ next: true, markdown: true, static: true });
    expect(result.agentEnabled).toBe(true);
    expect(result.skillPath).toBe("agent/skill.md");
  });

  it("returns undefined fields for unrecognised sources", () => {
    const result = extractWorkspaceConfig("not a config at all", ".ts");
    expect(result.outputDirectory).toBeUndefined();
    expect(result.layout).toBeUndefined();
    expect(result.agentEnabled).toBeUndefined();
  });
});
