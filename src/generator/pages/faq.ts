import type { GeneratorContext, GeneratedPage } from "../core/types.js";

/**
 * Generates a FAQ page from project analysis.
 */
export function generateFaqPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const projectName = analysis.packageInfo?.name ?? "Project";
  const sections: string[] = [];

  sections.push("# Frequently Asked Questions");
  sections.push("");
  sections.push(`Common questions about **${projectName}**.`);
  sections.push("");

  sections.push("## General");
  sections.push("");

  sections.push(`### What is ${projectName}?`);
  sections.push("");
  sections.push(`${analysis.packageInfo?.description ?? `${projectName} is a software project.`}`);
  sections.push("");

  sections.push("### What language is this project written in?");
  sections.push("");
  if (analysis.hasTypeScript) {
    sections.push("This project is written in **TypeScript**.");
  } else {
    sections.push("This project is written in **JavaScript**.");
  }
  sections.push("");

  if (analysis.framework.name) {
    sections.push(`### What framework does this project use?`);
    sections.push("");
    sections.push(
      `This project uses **${analysis.framework.name}**${analysis.framework.version ? ` v${analysis.framework.version}` : ""}.`,
    );
    sections.push("");
  }

  sections.push("## Installation");
  sections.push("");

  sections.push("### How do I install the dependencies?");
  sections.push("");
  sections.push("```bash");
  const pm = analysis.packageManager;
  if (pm === "pnpm") {
    sections.push("pnpm install");
  } else if (pm === "yarn") {
    sections.push("yarn install");
  } else if (pm === "bun") {
    sections.push("bun install");
  } else {
    sections.push("npm install");
  }
  sections.push("```");
  sections.push("");

  if (analysis.scripts["dev"]) {
    sections.push("## Development");
    sections.push("");
    sections.push("### How do I start the development server?");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} dev`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.scripts["build"]) {
    sections.push("### How do I build for production?");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} build`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.scripts["test"]) {
    sections.push("### How do I run tests?");
    sections.push("");
    sections.push("```bash");
    sections.push(`${pm === "npm" ? "npm run" : pm} test`);
    sections.push("```");
    sections.push("");
  }

  if (analysis.hasDocker) {
    sections.push("## Docker");
    sections.push("");
    sections.push("### How do I run with Docker?");
    sections.push("");
    sections.push("```bash");
    sections.push("docker build -t " + projectName + " .");
    sections.push("docker run -p 3000:3000 " + projectName);
    sections.push("```");
    sections.push("");
  }

  return {
    slug: "faq",
    title: "FAQ",
    description: `Frequently asked questions about ${projectName}`,
    category: "Resources",
    order: 8,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["troubleshooting", "guides/getting-started"],
    readingTimeMinutes: 3,
  };
}
