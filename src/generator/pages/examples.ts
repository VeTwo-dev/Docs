import type { GeneratorContext, GeneratedPage } from "../core/types.js";

/**
 * Generates examples/recipes page from project analysis.
 */
export function generateExamplesPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const projectName = analysis.packageInfo?.name ?? "Project";
  const sections: string[] = [];

  sections.push("# Examples");
  sections.push("");
  sections.push(`Usage examples and recipes for **${projectName}**.`);
  sections.push("");

  if (analysis.scripts["dev"]) {
    sections.push("## Quick Start");
    sections.push("");
    sections.push("```bash");
    const pm = analysis.packageManager;
    sections.push(`${pm === "npm" ? "npm run" : pm} dev`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.publicExports.length > 0) {
    sections.push("## API Usage");
    sections.push("");
    sections.push("```ts");
    sections.push(`import { ${analysis.publicExports[0]!.name} } from '${projectName}';`);
    sections.push("```");
    sections.push("");
  }

  sections.push("## Recipes");
  sections.push("");

  if (analysis.hasDocker) {
    sections.push("### Docker");
    sections.push("");
    sections.push("```bash");
    sections.push(`docker build -t ${projectName} .`);
    sections.push(`docker run -p 3000:3000 ${projectName}`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.hasCI) {
    sections.push("### CI/CD");
    sections.push("");
    sections.push("This project has CI/CD configured.");
    sections.push("");
  }

  return {
    slug: "examples",
    title: "Examples",
    description: `Usage examples and recipes for ${projectName}`,
    category: "Resources",
    order: 7,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["getting-started", "configuration"],
    readingTimeMinutes: 2,
  };
}
