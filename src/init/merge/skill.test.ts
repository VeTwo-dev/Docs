import { describe, it, expect } from "vitest";
import { buildSkillContent } from "../templates/skill.js";
import { mergeSkillContent } from "./skill.js";

const INCOMING = buildSkillContent({
  projectName: "Acme",
  projectDescription: "A widget library",
  projectType: "library",
  packageManager: "pnpm",
  packages: [{ name: "@acme/widgets", description: "Core widgets" }],
  outputDirectory: "docs",
  skillPath: "agent/skill.md",
  generatedAt: "2026-01-01T00:00:00.000Z",
});

describe("mergeSkillContent", () => {
  it("preserves user content outside managed sections", () => {
    const userNote = "\n## Team Notes\n\n- Keep the docs in British English.\n";
    const existing = INCOMING.replace("## Validation", `${userNote}\n## Validation`);
    const merged = mergeSkillContent(existing, INCOMING);

    expect(merged).toContain(userNote.trim());
  });

  it("keeps existing managed section bodies by default", () => {
    const existing = INCOMING.replace(
      "The project this documentation describes:",
      "The project this documentation describes:\n\n(edited by user)",
    );
    const merged = mergeSkillContent(existing, INCOMING);
    expect(merged).toContain("(edited by user)");
  });

  it("replaces managed section bodies when updateManaged is set", () => {
    const existing = INCOMING.replace(
      "The project this documentation describes:",
      "The project this documentation describes:\n\n(edited by user)",
    );
    const merged = mergeSkillContent(existing, INCOMING, { updateManaged: true });
    expect(merged).not.toContain("(edited by user)");
  });

  it("preserves unknown frontmatter keys", () => {
    const existing = INCOMING.replace("---\nskill:", "---\ncustom: keep-me\nskill:");
    const merged = mergeSkillContent(existing, INCOMING);
    expect(merged).toContain("custom: keep-me");
  });

  it("stamps the system skill id", () => {
    const merged = mergeSkillContent(INCOMING, INCOMING);
    expect(merged).toContain("skill: vetwo-docs");
  });

  it("produces content that parses as valid frontmatter", async () => {
    const { default: matter } = await import("gray-matter");
    const merged = mergeSkillContent(INCOMING, INCOMING);
    const parsed = matter(merged);
    expect(parsed.data.skill).toBe("vetwo-docs");
    expect(parsed.data.generatedBy).toBe("@vetwo/docs");
  });
});
