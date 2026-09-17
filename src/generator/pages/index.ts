import type { GeneratorContext, GeneratedPage, GeneratedMetadata } from "../core/types.js";
import { generateOverviewPage } from "./overview.js";
import { generateArchitecturePage } from "./architecture.js";
import { generateGuidesPage } from "./guides.js";
import { generateConfigurationPage } from "./configuration.js";
import { generateCliPage } from "./cli.js";
import { generateFaqPage } from "./faq.js";
import { generateTroubleshootingPage } from "./troubleshooting.js";
import { generateExamplesPage } from "./examples.js";
import {
  generateSidebarMetadata,
  generateNavigationMetadata,
  generateSearchMetadata,
  generateApiMetadata,
} from "../metadata/index.js";

export {
  generateOverviewPage,
  generateArchitecturePage,
  generateGuidesPage,
  generateConfigurationPage,
  generateCliPage,
  generateFaqPage,
  generateTroubleshootingPage,
  generateExamplesPage,
};

/** A function that generates documentation pages. */
export type PageGenerator = (ctx: GeneratorContext) => GeneratedPage;

/** A function that generates metadata files. */
export type MetadataGenerator = (
  ctx: GeneratorContext,
  pages: readonly GeneratedPage[],
) => GeneratedMetadata;

/** Registry entry for a page generator. */
interface PageGeneratorEntry {
  readonly key: string;
  readonly configKey: keyof GeneratorContext["config"] | null;
  readonly generator: PageGenerator;
}

const PAGE_GENERATORS: readonly PageGeneratorEntry[] = [
  { key: "overview", configKey: null, generator: generateOverviewPage },
  { key: "architecture", configKey: "architecture", generator: generateArchitecturePage },
  { key: "guides", configKey: "guides", generator: generateGuidesPage },
  { key: "configuration", configKey: "configuration", generator: generateConfigurationPage },
  { key: "cli", configKey: "cli", generator: generateCliPage },
  { key: "faq", configKey: "faq", generator: generateFaqPage },
  { key: "troubleshooting", configKey: "troubleshooting", generator: generateTroubleshootingPage },
  { key: "examples", configKey: "examples", generator: generateExamplesPage },
];

/**
 * Runs all enabled page generators and returns the results.
 */
export function runPageGenerators(ctx: GeneratorContext): GeneratedPage[] {
  const pages: GeneratedPage[] = [];
  for (const entry of PAGE_GENERATORS) {
    if (entry.configKey === null || ctx.config[entry.configKey]) {
      pages.push(entry.generator(ctx));
    }
  }
  return pages;
}

/**
 * Runs all metadata generators and returns the results.
 */
export function runMetadataGenerators(
  ctx: GeneratorContext,
  pages: readonly GeneratedPage[],
): GeneratedMetadata[] {
  const metadata: GeneratedMetadata[] = [];
  if (ctx.config.sidebar) {
    metadata.push(generateSidebarMetadata(ctx, pages));
  }
  if (ctx.config.navigation) {
    metadata.push(generateNavigationMetadata(ctx, pages));
  }
  if (ctx.config.search) {
    metadata.push(generateSearchMetadata(ctx, pages));
  }
  if (ctx.config.api) {
    metadata.push(generateApiMetadata(ctx));
  }
  return metadata;
}
