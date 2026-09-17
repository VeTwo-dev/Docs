import type { GeneratorContext, GeneratedPage } from "../core/types.js";

/**
 * Generates a getting-started guide page.
 */
export function generateGuidesPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const pkg = analysis.packageInfo;
  const projectName = pkg?.name ?? "Project";
  const sections: string[] = [];

  sections.push(`# Getting Started`);
  sections.push("");
  sections.push(`This guide will help you get started with **${projectName}**.`);
  sections.push("");

  sections.push("## Prerequisites");
  sections.push("");
  sections.push("- Node.js >= 20");
  sections.push(`- ${analysis.packageManager} package manager`);
  if (analysis.hasTypeScript) {
    sections.push("- TypeScript knowledge");
  }
  sections.push("");

  sections.push("## Installation");
  sections.push("");
  const pm = analysis.packageManager;
  sections.push("```bash");
  if (pm === "pnpm") {
    sections.push(`pnpm add ${projectName}`);
  } else if (pm === "yarn") {
    sections.push(`yarn add ${projectName}`);
  } else if (pm === "bun") {
    sections.push(`bun add ${projectName}`);
  } else {
    sections.push(`npm install ${projectName}`);
  }
  sections.push("```");
  sections.push("");

  if (analysis.framework.name) {
    sections.push("## Framework Setup");
    sections.push("");
    sections.push(`This project is built with **${analysis.framework.name}**.`);
    sections.push("");
  }

  if (analysis.scripts["dev"]) {
    sections.push("## Development");
    sections.push("");
    sections.push("Start the development server:");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} dev`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.scripts["build"]) {
    sections.push("## Build");
    sections.push("");
    sections.push("Build for production:");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} build`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.scripts["test"]) {
    sections.push("## Testing");
    sections.push("");
    sections.push("Run the test suite:");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} test`);
    sections.push("```");
    sections.push("");
  }

  sections.push("## Next Steps");
  sections.push("");
  sections.push("- Read the [Architecture](/architecture) overview");
  sections.push("- Explore the [API Reference](/api)");
  sections.push("- Check the [Configuration](/configuration) options");
  sections.push("");

  return {
    slug: "guides/getting-started",
    title: "Getting Started",
    description: `How to get started with ${projectName}`,
    category: "Guides",
    order: 1,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["overview", "architecture", "configuration"],
    readingTimeMinutes: 3,
  };
}
