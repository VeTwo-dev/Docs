/**
 * AI Skill Integration.
 *
 * Generates and manages the `agent/skill.md` file that serves as the
 * AI operating contract. The skill instructs the AI to read project
 * intelligence, documentation plans, terminology, examples, and
 * relationships before generating documentation.
 */

/** Sections managed by the AI system in the skill file. */
export const AI_MANAGED_SECTIONS = [
  "ai-intelligence",
  "ai-workflow",
  "ai-validation",
  "ai-terminology",
] as const;

/** The skill section marker format. */
const SECTION_OPEN = (id: string) => `<!-- @vetwo-managed:${id} -->`;
const SECTION_CLOSE = (id: string) => `<!-- /@vetwo-managed:${id} -->`;

/**
 * Build the AI intelligence section of the skill file.
 * This section tells the AI how to use project intelligence.
 */
export function buildAIIntelligenceSection(): string {
  return [
    SECTION_OPEN("ai-intelligence"),
    "",
    "## AI Documentation Intelligence",
    "",
    "Before generating any documentation, read and understand:",
    "",
    "1. **Project Intelligence** from `.vetwo/docs/ai/` — the structured analysis of this project",
    "2. **Documentation Plan** from `.vetwo/docs/ai/plans/` — what pages to generate and their intents",
    "3. **Terminology Dictionary** — use canonical names, never invent terminology",
    "4. **Examples** — prefer real extracted examples over invented ones",
    "5. **Relationships** — maintain navigation consistency across pages",
    "6. **Documentation Gaps** — prioritize high-value gaps",
    "",
    "### Intelligence Sources",
    "",
    "| Source | Location | Purpose |",
    "|--------|----------|---------|",
    "| Knowledge Graph | `.vetwo/docs/graph/` | Module relationships, dependencies |",
    "| Symbol Index | `.vetwo/docs/symbols/` | Public API surface |",
    "| Reference Graph | `.vetwo/docs/references/` | Import/export bindings |",
    "| Examples | `.vetwo/docs/examples/` | Real code examples |",
    "| Documentation Relations | `.vetwo/docs/relationships/` | Navigation, learning paths |",
    "",
    SECTION_CLOSE("ai-intelligence"),
  ].join("\n");
}

/**
 * Build the AI workflow section of the skill file.
 */
export function buildAIWorkflowSection(): string {
  return [
    SECTION_OPEN("ai-workflow"),
    "",
    "## AI Documentation Workflow",
    "",
    "Follow this workflow for every documentation generation task:",
    "",
    "1. Read the project intelligence summary",
    "2. Read the documentation plan for the target page",
    "3. Read the terminology dictionary",
    "4. Collect relevant examples from the example store",
    "5. Read the documentation relationships for navigation context",
    "6. Generate structured content (Markdown/MDX)",
    "7. Validate all claims against project evidence",
    "8. Validate all links against the documentation model",
    "9. Preserve existing user content — never overwrite",
    "10. Maintain canonical terminology throughout",
    "",
    "### Critical Rules",
    "",
    "- **Never invent APIs** — only document symbols that exist in the project",
    "- **Never hallucinate configuration** — only reference config keys that are defined",
    "- **Always ground claims in evidence** — cite symbol names, file paths, graph edges",
    "- **Prefer real examples** — use extracted examples over generated ones",
    "- **Respect the documentation plan** — don't generate pages not in the plan",
    "- **Maintain navigation consistency** — use the same slugs and titles as the plan",
    "",
    SECTION_CLOSE("ai-workflow"),
  ].join("\n");
}

/**
 * Build the AI validation section of the skill file.
 */
export function buildAIValidationSection(): string {
  return [
    SECTION_OPEN("ai-validation"),
    "",
    "## AI Validation Rules",
    "",
    "Every generated page must pass these validation checks:",
    "",
    "### Claim Validation",
    "- Every factual claim must reference a symbol, file, or configuration that exists",
    '- Claims like "X does Y" must be verifiable against the knowledge graph',
    '- Uncertain information must be marked as "inferred" or "recommended"',
    "",
    "### Link Validation",
    "- All internal links must resolve to existing documentation slugs",
    "- All API references must match actual exported symbols",
    "- External links should be valid URLs",
    "",
    "### Terminology Validation",
    "- Use canonical names from the project terminology dictionary",
    "- Do not translate code identifiers (API names, package names, config keys)",
    "- Maintain consistent terminology across all generated pages",
    "",
    "### Example Validation",
    "- Examples must reference real APIs that exist in the project",
    "- Import paths must be correct",
    "- Code must be syntactically valid",
    "",
    SECTION_CLOSE("ai-validation"),
  ].join("\n");
}

/**
 * Build the AI terminology section of the skill file.
 */
export function buildAITerminologySection(
  terminology?: readonly { canonical: string; category?: string; aliases?: readonly string[] }[],
): string {
  const lines = [SECTION_OPEN("ai-terminology"), "", "## Project Terminology", ""];

  if (terminology !== undefined && terminology.length > 0) {
    lines.push("| Canonical | Category | Aliases |");
    lines.push("|-----------|----------|---------|");
    for (const term of terminology) {
      lines.push(
        `| \`${term.canonical}\` | ${term.category ?? "-"} | ${term.aliases?.join(", ") ?? "-"} |`,
      );
    }
  } else {
    lines.push(
      "No terminology dictionary detected. The AI should infer terminology from project symbols and configuration.",
    );
  }

  lines.push("");
  lines.push(
    "Use canonical names consistently. Never invent terminology not present in this dictionary.",
  );
  lines.push("");
  lines.push(SECTION_CLOSE("ai-terminology"));

  return lines.join("\n");
}

/**
 * Build the complete AI skill content.
 */
export function buildAISkillContent(options: {
  terminology?: readonly { canonical: string; category?: string; aliases?: readonly string[] }[];
}): string {
  return [
    buildAIIntelligenceSection(),
    "",
    buildAIWorkflowSection(),
    "",
    buildAIValidationSection(),
    "",
    buildAITerminologySection(options.terminology),
  ].join("\n");
}

/**
 * Extract managed sections from existing skill content.
 * Returns a map of section ID → section content.
 */
export function extractAIManagedSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();

  for (const sectionId of AI_MANAGED_SECTIONS) {
    const openMarker = SECTION_OPEN(sectionId);
    const closeMarker = SECTION_CLOSE(sectionId);
    const start = content.indexOf(openMarker);
    const end = content.indexOf(closeMarker);

    if (start !== -1 && end !== -1 && end > start) {
      sections.set(sectionId, content.slice(start, end + closeMarker.length));
    }
  }

  return sections;
}

/**
 * Merge AI managed sections into existing skill content,
 * preserving user-authored sections.
 */
export function mergeAISkillContent(existing: string, aiSections: string): string {
  let result = existing;

  for (const sectionId of AI_MANAGED_SECTIONS) {
    const openMarker = SECTION_OPEN(sectionId);
    const closeMarker = SECTION_CLOSE(sectionId);
    const start = result.indexOf(openMarker);
    const end = result.indexOf(closeMarker);

    // Extract the new section content
    const newStart = aiSections.indexOf(openMarker);
    const newEnd = aiSections.indexOf(closeMarker);
    if (newStart === -1 || newEnd === -1) continue;
    const newSection = aiSections.slice(newStart, newEnd + closeMarker.length);

    if (start !== -1 && end !== -1 && end > start) {
      // Replace existing section
      result = result.slice(0, start) + newSection + result.slice(end + closeMarker.length);
    } else {
      // Append new section
      result = result + "\n\n" + newSection;
    }
  }

  return result;
}
