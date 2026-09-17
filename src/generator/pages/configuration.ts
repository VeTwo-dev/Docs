import type { GeneratorContext, GeneratedPage } from "../core/types.js";

/**
 * Generates the configuration reference page.
 */
export function generateConfigurationPage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const sections: string[] = [];

  sections.push("# Configuration Reference");
  sections.push("");
  sections.push("Configuration files and settings for this project.");
  sections.push("");

  if (analysis.configFiles.length === 0) {
    sections.push("No configuration files detected.");
    return {
      slug: "configuration",
      title: "Configuration Reference",
      description: "Configuration files and settings",
      category: "Configuration",
      order: 3,
      content: sections.join("\n"),
      source: "auto-generated",
      related: ["overview"],
      readingTimeMinutes: 1,
    };
  }

  const byKind = new Map<string, Array<(typeof analysis.configFiles)[number]>>();
  for (const cfg of analysis.configFiles) {
    const list = byKind.get(cfg.kind) ?? [];
    list.push(cfg);
    byKind.set(cfg.kind, list);
  }

  const kindLabels: Record<string, string> = {
    "package-manager": "Package Manager",
    typescript: "TypeScript",
    bundler: "Bundler",
    framework: "Framework",
    linter: "Linter",
    formatter: "Formatter",
    ci: "CI/CD",
    docker: "Docker",
    workspace: "Workspace",
    env: "Environment",
    other: "Other",
  };

  for (const [kind, files] of byKind) {
    sections.push(`## ${kindLabels[kind] ?? kind}`);
    sections.push("");
    for (const file of files) {
      sections.push(`### \`${file.name}\``);
      sections.push("");
      sections.push(`- **Path:** \`${file.path}\``);
      sections.push(`- **Type:** ${file.kind}`);
      sections.push("");
    }
  }

  if (analysis.hasTypeScript) {
    sections.push("## TypeScript");
    sections.push("");
    sections.push("This project uses TypeScript. See `tsconfig.json` for compiler options.");
    sections.push("");
  }

  sections.push("## Related");
  sections.push("");
  sections.push("- [Architecture](/architecture)");
  sections.push("- [Overview](/overview)");
  sections.push("");

  return {
    slug: "configuration",
    title: "Configuration Reference",
    description: "Configuration files and settings for this project",
    category: "Configuration",
    order: 3,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["overview", "architecture"],
    readingTimeMinutes: 2,
  };
}
