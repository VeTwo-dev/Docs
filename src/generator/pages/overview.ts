import type { GeneratorContext, GeneratedPage } from "../core/types.js";
import { describeScript } from "./utils.js";

/**
 * Generates the project overview page.
 */
export function generateOverviewPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const pkg = analysis.packageInfo;
  const projectName = pkg?.name ?? "Project";
  const description = pkg?.description ?? "Documentation";

  const sections: string[] = [];

  sections.push(`# ${projectName}`);
  sections.push("");
  sections.push(description);
  sections.push("");

  if (pkg) {
    sections.push(`**Version:** ${pkg.version}`);
    sections.push("");
  }

  sections.push("## Quick Start");
  sections.push("");
  sections.push(`Install ${projectName}:`);
  sections.push("");

  const pm = analysis.packageManager;
  if (pm === "pnpm") {
    sections.push("```bash");
    sections.push(`pnpm add ${projectName}`);
    sections.push("```");
  } else if (pm === "yarn") {
    sections.push("```bash");
    sections.push(`yarn add ${projectName}`);
    sections.push("```");
  } else if (pm === "bun") {
    sections.push("```bash");
    sections.push(`bun add ${projectName}`);
    sections.push("```");
  } else {
    sections.push("```bash");
    sections.push(`npm install ${projectName}`);
    sections.push("```");
  }
  sections.push("");

  if (analysis.framework.name) {
    sections.push("## Framework");
    sections.push("");
    sections.push(
      `This project uses **${analysis.framework.name}**${analysis.framework.version ? ` v${analysis.framework.version}` : ""}.`,
    );
    sections.push("");
  }

  if (Object.keys(analysis.scripts).length > 0) {
    sections.push("## Scripts");
    sections.push("");
    sections.push("| Command | Description |");
    sections.push("| --- | --- |");
    for (const [name] of Object.entries(analysis.scripts)) {
      const desc = describeScript(name);
      sections.push(`| \`${name}\` | ${desc} |`);
    }
    sections.push("");
  }

  const techStack: string[] = [];
  if (analysis.hasTypeScript) techStack.push("TypeScript");
  if (analysis.hasTests) techStack.push("Testing");
  if (analysis.hasCI) techStack.push("CI/CD");
  if (analysis.hasDocker) techStack.push("Docker");
  if (analysis.hasReadme) techStack.push("README");
  if (analysis.hasLicense) techStack.push("License");

  if (techStack.length > 0) {
    sections.push("## Features");
    sections.push("");
    for (const feature of techStack) {
      sections.push(`- ${feature}`);
    }
    sections.push("");
  }

  return {
    slug: "overview",
    title: `${projectName} Overview`,
    description,
    category: "Getting Started",
    order: 1,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["architecture", "guides/getting-started", "configuration"],
    readingTimeMinutes: 2,
  };
}
