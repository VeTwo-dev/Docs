import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills", "docs-bootstrap");
const skill = readFileSync(join(dir, "SKILL.md"), "utf8");

function frontmatter(): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(skill);
  expect(match).not.toBeNull();
  const out: Record<string, string> = {};
  let current = "";
  for (const line of (match?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    // Continuation lines (no key) belong to folded scalars like `description: >`.
    if (i <= 0 || line.slice(0, i).trim().includes(" ")) {
      if (current !== "") out[current] = `${out[current] ?? ""} ${line.trim()}`.trim();
      continue;
    }
    current = line.slice(0, i).trim();
    out[current] = line
      .slice(i + 1)
      .trim()
      .replace(/^>\s*/, "");
  }
  return out;
}

describe("docs-bootstrap skill (portable)", () => {
  it("has valid frontmatter with name and description", () => {
    const fm = frontmatter();
    expect(fm["name"]).toBe("docs-bootstrap");
    expect(fm["description"]?.length ?? 0).toBeGreaterThan(50);
  });

  it("defines the audit → generate → validate workflow", () => {
    for (const heading of ["## Workflow", "### 1. Audit", "### 3. Validate"]) {
      expect(skill).toContain(heading);
    }
    for (const cmd of ["docs doctor", "docs generate", "docs validate-output"]) {
      expect(skill).toContain(cmd);
    }
  });

  it("covers all essential material without inventing facts", () => {
    for (const item of [
      "package.json",
      "README",
      "tsconfig",
      "JSDoc",
      "examples",
      "CLI",
      "package manager",
    ]) {
      expect(skill.toLowerCase()).toContain(item.toLowerCase());
    }
    expect(skill).toContain("Never invent");
  });

  it("contains no repo-absolute paths (stays portable)", () => {
    expect(skill).not.toContain("/media/");
    expect(skill).not.toContain("/home/");
    expect(skill).not.toContain("VeTwo");
  });

  it("ships a minimal docs.config.ts template", () => {
    expect(skill).toContain("defineDocs");
    expect(skill).toContain("@vetwo/docs/config");
    expect(skill).toContain("docs/next/node_modules/");
  });
});
