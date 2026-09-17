import type { GeneratorContext, GeneratedPage } from "../core/types.js";

/**
 * Generates a troubleshooting page.
 */
export function generateTroubleshootingPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const projectName = analysis.packageInfo?.name ?? "Project";
  const sections: string[] = [];

  sections.push("# Troubleshooting");
  sections.push("");
  sections.push(`Common issues and solutions for **${projectName}**.`);
  sections.push("");

  sections.push("## Common Issues");
  sections.push("");

  sections.push("### Build fails");
  sections.push("");
  sections.push("**Solution:**");
  sections.push("1. Ensure all dependencies are installed");
  sections.push("2. Check for TypeScript errors");
  sections.push("3. Verify configuration files are valid");
  sections.push("");

  sections.push("### Dependencies not found");
  sections.push("");
  sections.push("**Solution:**");
  sections.push("```bash");
  const pm = analysis.packageManager;
  if (pm === "pnpm") {
    sections.push("rm -rf node_modules && pnpm install");
  } else if (pm === "yarn") {
    sections.push("rm -rf node_modules && yarn install");
  } else if (pm === "bun") {
    sections.push("rm -rf node_modules && bun install");
  } else {
    sections.push("rm -rf node_modules && npm install");
  }
  sections.push("```");
  sections.push("");

  if (analysis.hasTypeScript) {
    sections.push("### TypeScript errors");
    sections.push("");
    sections.push("**Solution:**");
    sections.push("1. Run `tsc --noEmit` to check for type errors");
    sections.push("2. Ensure `tsconfig.json` is configured correctly");
    sections.push("3. Check for missing type definitions");
    sections.push("");
  }

  if (analysis.hasTests) {
    sections.push("### Tests failing");
    sections.push("");
    sections.push("**Solution:**");
    sections.push("1. Run tests in isolation");
    sections.push("2. Check for environment variable dependencies");
    sections.push("3. Verify test configuration");
    sections.push("");
  }

  sections.push("## Getting Help");
  sections.push("");
  sections.push("- Check the [FAQ](/faq)");
  sections.push("- Open an issue on GitHub");
  sections.push("- Review the [Getting Started](/guides/getting-started) guide");
  sections.push("");

  return {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: `Common issues and solutions for ${projectName}`,
    category: "Resources",
    order: 9,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["faq", "guides/getting-started"],
    readingTimeMinutes: 2,
  };
}
