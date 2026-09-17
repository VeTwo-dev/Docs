import { describe, it, expect } from "vitest";
import {
  SKILL_ID,
  MANAGED_START,
  MANAGED_END,
  buildSkillFrontmatter,
  buildSkillContent,
  managedSection,
  extractManagedSections,
  hasManagedSections,
} from "./skill.js";

const baseCtx = {
  projectName: "Acme",
  projectDescription: "A widget library",
  projectType: "library",
  packageManager: "pnpm",
  packages: [{ name: "@acme/widgets", description: "Core widgets" }],
  outputDirectory: "docs",
  skillPath: "agent/skill.md",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildSkillFrontmatter", () => {
  it("quotes string values that are not plain YAML scalars", () => {
    const fm = buildSkillFrontmatter(baseCtx);
    expect(fm).toContain('generatedBy: "@vetwo/docs"');
  });

  it("round-trips through gray-matter without errors", async () => {
    const { default: matter } = await import("gray-matter");
    const content = buildSkillContent(baseCtx);
    const parsed = matter(content);
    expect(parsed.data.skill).toBe(SKILL_ID);
    expect(parsed.data.generatedBy).toBe("@vetwo/docs");
    expect(parsed.data.project).toBe("Acme");
    expect(parsed.data.version).toBeGreaterThanOrEqual(1);
  });
});

describe("managedSection", () => {
  it("wraps a body in start/end markers", () => {
    const section = managedSection("output-layout", "content");
    expect(section).toBe(
      `<!-- ${MANAGED_START} output-layout -->\n\ncontent\n\n<!-- ${MANAGED_END} output-layout -->`,
    );
  });
});

describe("buildSkillContent", () => {
  it("contains both managed sections", () => {
    const content = buildSkillContent(baseCtx);
    expect(extractManagedSections(content).has("project-context")).toBe(true);
    expect(extractManagedSections(content).has("output-layout")).toBe(true);
    expect(hasManagedSections(content)).toBe(true);
  });
});

describe("extractManagedSections", () => {
  it("extracts section bodies without markers", () => {
    const content = [
      managedSection("project-context", "Project: Acme"),
      "",
      managedSection("output-layout", "Root: docs/"),
    ].join("\n");
    const sections = extractManagedSections(content);
    expect(sections.get("project-context")).toBe("Project: Acme");
    expect(sections.get("output-layout")).toBe("Root: docs/");
  });

  it("ignores content without markers", () => {
    expect(extractManagedSections("plain text").size).toBe(0);
  });
});
