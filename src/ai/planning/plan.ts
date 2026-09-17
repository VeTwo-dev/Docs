/**
 * AI Documentation Planning Engine.
 *
 * Before generating prose, the engine produces a structured documentation
 * plan that respects the Documentation Relationship Engine, project type,
 * audience, and identified gaps.
 */

import type { AIDocumentationIntent, AIAudience } from "../types.js";
import type { AIDiagramType } from "../types.js";

/** A single page in the documentation plan. */
export interface DocPlanPage {
  /** Page slug. */
  readonly slug: string;
  /** Page title. */
  readonly title: string;
  /** Documentation intent. */
  readonly intent: AIDocumentationIntent;
  /** Target audience. */
  readonly audience: AIAudience;
  /** Estimated word count. */
  readonly estimatedWords: number;
  /** APIs this page should cover. */
  readonly apis?: readonly string[];
  /** Concepts this page should explain. */
  readonly concepts?: readonly string[];
  /** Examples to include. */
  readonly examples?: readonly string[];
  /** Diagrams to generate. */
  readonly diagrams?: readonly { type: AIDiagramType; description: string }[];
  /** Related page slugs. */
  readonly relatedPages?: readonly string[];
  /** Priority (higher = more important). */
  readonly priority: number;
  /** Whether this page already exists and should be updated. */
  readonly existing?: boolean;
  /** Dependencies on other pages (must be generated first). */
  readonly dependencies?: readonly string[];
}

/** A complete documentation plan. */
export interface DocumentationPlan {
  /** Project name. */
  readonly projectName: string;
  /** Project type inference. */
  readonly projectType: string;
  /** When the plan was created. */
  readonly createdAt: string;
  /** All planned pages. */
  readonly pages: readonly DocPlanPage[];
  /** Gaps this plan addresses. */
  readonly gapsAddressed?: readonly string[];
  /** Gaps remaining after this plan. */
  readonly gapsRemaining?: readonly string[];
  /** Total estimated word count. */
  readonly totalEstimatedWords: number;
}

/** Documentation structure templates by project type. */
const STRUCTURE_TEMPLATES: Record<string, readonly Omit<DocPlanPage, "slug" | "priority">[]> = {
  library: [
    { title: "Overview", intent: "overview", audience: "developer", estimatedWords: 500 },
    { title: "Installation", intent: "installation", audience: "developer", estimatedWords: 300 },
    { title: "Quick Start", intent: "getting-started", audience: "beginner", estimatedWords: 800 },
    { title: "Core Concepts", intent: "concept", audience: "developer", estimatedWords: 1200 },
    {
      title: "API Reference",
      intent: "api-reference",
      audience: "api-consumer",
      estimatedWords: 2000,
    },
    { title: "Guides", intent: "guide", audience: "developer", estimatedWords: 1500 },
    { title: "Configuration", intent: "configuration", audience: "developer", estimatedWords: 600 },
    { title: "Examples", intent: "example", audience: "developer", estimatedWords: 1000 },
    { title: "Migration Guide", intent: "migration", audience: "advanced", estimatedWords: 800 },
    {
      title: "Troubleshooting",
      intent: "troubleshooting",
      audience: "developer",
      estimatedWords: 500,
    },
  ],
  framework: [
    { title: "Introduction", intent: "overview", audience: "beginner", estimatedWords: 600 },
    { title: "Core Concepts", intent: "concept", audience: "beginner", estimatedWords: 1500 },
    {
      title: "Getting Started",
      intent: "getting-started",
      audience: "beginner",
      estimatedWords: 1000,
    },
    { title: "Routing", intent: "guide", audience: "developer", estimatedWords: 1200 },
    { title: "Data Handling", intent: "guide", audience: "developer", estimatedWords: 1000 },
    { title: "Rendering", intent: "guide", audience: "developer", estimatedWords: 1000 },
    { title: "Configuration", intent: "configuration", audience: "developer", estimatedWords: 800 },
    {
      title: "API Reference",
      intent: "api-reference",
      audience: "api-consumer",
      estimatedWords: 2000,
    },
    { title: "Advanced Usage", intent: "guide", audience: "advanced", estimatedWords: 1200 },
  ],
  cli: [
    { title: "Introduction", intent: "overview", audience: "beginner", estimatedWords: 400 },
    { title: "Installation", intent: "installation", audience: "beginner", estimatedWords: 200 },
    { title: "Commands", intent: "cli-reference", audience: "developer", estimatedWords: 1500 },
    { title: "Configuration", intent: "configuration", audience: "developer", estimatedWords: 600 },
    { title: "Workflows", intent: "guide", audience: "developer", estimatedWords: 1000 },
    { title: "Examples", intent: "example", audience: "developer", estimatedWords: 800 },
    { title: "Plugins", intent: "guide", audience: "plugin-author", estimatedWords: 800 },
    {
      title: "Troubleshooting",
      intent: "troubleshooting",
      audience: "developer",
      estimatedWords: 500,
    },
  ],
  backend: [
    { title: "Architecture", intent: "architecture", audience: "maintainer", estimatedWords: 1500 },
    { title: "Setup", intent: "getting-started", audience: "developer", estimatedWords: 800 },
    { title: "Configuration", intent: "configuration", audience: "developer", estimatedWords: 600 },
    { title: "Services", intent: "concept", audience: "developer", estimatedWords: 1200 },
    {
      title: "API Reference",
      intent: "api-reference",
      audience: "api-consumer",
      estimatedWords: 2000,
    },
    { title: "Data Model", intent: "concept", audience: "developer", estimatedWords: 1000 },
    { title: "Deployment", intent: "deployment", audience: "operator", estimatedWords: 800 },
    {
      title: "Troubleshooting",
      intent: "troubleshooting",
      audience: "operator",
      estimatedWords: 500,
    },
  ],
};

/**
 * Infer the project type from intelligence data.
 */
export function inferProjectType(input: {
  type?: string;
  framework?: string;
  dependencies?: readonly string[];
  hasCli?: boolean;
  hasServer?: boolean;
}): string {
  if (input.type === "cli" || input.hasCli) return "cli";
  if (input.hasServer) return "backend";
  if (input.framework !== undefined) return "framework";
  if (input.type === "library" || input.type === "module") return "library";
  return "library"; // default
}

/**
 * Generate a documentation plan for a project.
 */
export function generateDocumentationPlan(input: {
  projectName: string;
  projectType?: string;
  apis?: readonly { name: string; kind: string }[];
  concepts?: readonly { name: string }[];
  gaps?: readonly { kind: string; target: string; priority: string }[];
  existingPages?: readonly { slug: string; title: string }[];
  audience?: AIAudience;
}): DocumentationPlan {
  const projectType = input.projectType ?? "library";
  const template = STRUCTURE_TEMPLATES[projectType] ?? STRUCTURE_TEMPLATES["library"] ?? [];

  const existingSlugs = new Set(input.existingPages?.map((p) => p.slug));

  const pages: DocPlanPage[] = template.map((page, index) => {
    const slug = page.title.toLowerCase().replace(/\s+/g, "-");
    return {
      slug,
      title: page.title,
      intent: page.intent,
      audience: page.audience ?? input.audience ?? "developer",
      estimatedWords: page.estimatedWords,
      apis: page.intent === "api-reference" ? input.apis?.map((a) => a.name) : undefined,
      concepts: page.intent === "concept" ? input.concepts?.map((c) => c.name) : undefined,
      priority: template.length - index,
      existing: existingSlugs.has(slug),
    };
  });

  return {
    projectName: input.projectName,
    projectType,
    createdAt: new Date().toISOString(),
    pages,
    totalEstimatedWords: pages.reduce((sum, p) => sum + p.estimatedWords, 0),
  };
}
