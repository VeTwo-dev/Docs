import type { GeneratorContext, GeneratedPage } from "../core/types.js";
import { describeScript } from "./utils.js";

/**
 * Generates the CLI reference page from package.json scripts.
 */
export function generateCliPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const projectName = analysis.packageInfo?.name ?? "Project";
  const sections: string[] = [];

  sections.push("# CLI Reference");
  sections.push("");
  sections.push(`Available commands and scripts for **${projectName}**.`);
  sections.push("");

  const scripts = analysis.scripts;
  const scriptNames = Object.keys(scripts);

  if (scriptNames.length === 0) {
    sections.push("No scripts defined in `package.json`.");
    return {
      slug: "cli",
      title: "CLI Reference",
      description: "Available commands and scripts",
      category: "CLI",
      order: 4,
      content: sections.join("\n"),
      source: "auto-generated",
      related: ["configuration"],
      readingTimeMinutes: 1,
    };
  }

  sections.push("## Available Scripts");
  sections.push("");
  sections.push("| Script | Command | Description |");
  sections.push("| --- | --- | --- |");
  for (const [name, cmd] of Object.entries(scripts)) {
    sections.push(`| \`${name}\` | \`${cmd}\` | ${describeScript(name)} |`);
  }
  sections.push("");

  sections.push("## Usage");
  sections.push("");
  sections.push("```bash");
  if (analysis.packageManager === "npm") {
    sections.push(`npm run <script-name>`);
  } else {
    sections.push(`${analysis.packageManager} <script-name>`);
  }
  sections.push("```");
  sections.push("");

  sections.push("## Examples");
  sections.push("");
  if (scripts["dev"]) {
    sections.push("```bash");
    sections.push(`# Start development`);
    sections.push(`${analysis.packageManager === "npm" ? "npm run" : analysis.packageManager} dev`);
    sections.push("```");
    sections.push("");
  }
  if (scripts["build"]) {
    sections.push("```bash");
    sections.push(`# Build for production`);
    sections.push(
      `${analysis.packageManager === "npm" ? "npm run" : analysis.packageManager} build`,
    );
    sections.push("```");
    sections.push("");
  }
  if (scripts["test"]) {
    sections.push("```bash");
    sections.push(`# Run tests`);
    sections.push(
      `${analysis.packageManager === "npm" ? "npm run" : analysis.packageManager} test`,
    );
    sections.push("```");
    sections.push("");
  }

  return {
    slug: "cli",
    title: "CLI Reference",
    description: "Available commands and scripts",
    category: "CLI",
    order: 4,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["configuration", "guides/getting-started"],
    readingTimeMinutes: 2,
  };
}
