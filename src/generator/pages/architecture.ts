import type { GeneratorContext, GeneratedPage, DirectoryNode } from "../core/types.js";

export function generateArchitecturePage(ctx: GeneratorContext): GeneratedPage {
  const { analysis } = ctx;
  const projectName = analysis.packageInfo?.name ?? "Project";
  const sections: string[] = [];

  sections.push("# Architecture");
  sections.push("");
  sections.push("Project structure and architecture for **" + projectName + "**.");
  sections.push("");

  sections.push("## Directory Structure");
  sections.push("");
  sections.push("```");
  sections.push(renderTree(analysis.directoryTree, "", true));
  sections.push("```");
  sections.push("");

  if (analysis.configFiles.length > 0) {
    sections.push("## Configuration Files");
    sections.push("");
    sections.push("| File | Type |");
    sections.push("| --- | --- |");
    for (const cfg of analysis.configFiles) {
      sections.push("| `" + cfg.path + "` | " + cfg.kind + " |");
    }
    sections.push("");
  }

  if (analysis.sourceFiles.length > 0) {
    const byDir = new Map<string, number>();
    for (const file of analysis.sourceFiles) {
      const dir = file.relativePath.split("/").slice(0, -1).join("/") || ".";
      byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
    }

    sections.push("## Source Files");
    sections.push("");
    sections.push(
      "**" +
        String(analysis.sourceFiles.length) +
        "** source files across **" +
        String(byDir.size) +
        "** directories.",
    );
    sections.push("");
    sections.push("| Directory | Files |");
    sections.push("| --- | --- |");
    const sorted = [...byDir.entries()].sort((a, b) => b[1] - a[1]);
    for (const [dir, count] of sorted.slice(0, 20)) {
      sections.push("| `" + dir + "` | " + String(count) + " |");
    }
    sections.push("");
  }

  const deps = Object.keys(analysis.dependencies);
  if (deps.length > 0) {
    sections.push("## Dependencies");
    sections.push("");
    sections.push("**" + String(deps.length) + "** production dependencies.");
    sections.push("");
  }

  const devDeps = Object.keys(analysis.devDependencies);
  if (devDeps.length > 0) {
    sections.push("## Dev Dependencies");
    sections.push("");
    sections.push("**" + String(devDeps.length) + "** development dependencies.");
    sections.push("");
  }

  return {
    slug: "architecture",
    title: "Architecture",
    description: "Project structure and architecture for " + projectName,
    category: "Architecture",
    order: 2,
    content: sections.join("\n"),
    source: "auto-generated",
    related: ["overview", "configuration"],
    readingTimeMinutes: 3,
  };
}

function renderTree(node: DirectoryNode, prefix: string, isLast: boolean): string {
  const lines: string[] = [];
  const connector = isLast ? "... " : "|-- ";
  const displayName = node.path === "." ? node.name || "." : node.name;

  if (node.path !== ".") {
    if (node.type === "directory") {
      lines.push(prefix + connector + displayName + "/");
    } else {
      lines.push(prefix + connector + displayName);
    }
  }

  if (node.type === "directory" && node.children.length > 0) {
    const newPrefix = node.path === "." ? "" : prefix + (isLast ? "    " : "|   ");
    const visibleChildren = node.children.slice(0, 50);
    for (let i = 0; i < visibleChildren.length; i++) {
      lines.push(renderTree(visibleChildren[i]!, newPrefix, i === visibleChildren.length - 1));
    }
    if (node.children.length > 50) {
      lines.push(prefix + "|-- ... " + String(node.children.length - 50) + " more items");
    }
  }

  return lines.join("\n");
}
