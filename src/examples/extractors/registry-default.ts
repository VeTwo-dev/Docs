import type { ExampleExtractor } from "./extractor.js";
import { createMarkdownExampleExtractor } from "./markdown.js";
import { createSourceExampleExtractor } from "./source.js";
import { createTestExampleExtractor } from "./tests.js";
import { createStorybookExampleExtractor } from "./storybook.js";
import { createPlaygroundExampleExtractor } from "./playground.js";
import { createCliExampleExtractor } from "./cli.js";
import { createConfigurationExampleExtractor } from "./configuration.js";
import { createFixtureExampleExtractor } from "./fixtures.js";
import { createExamplesDirectoryExampleExtractor } from "./examples-directory.js";

/**
 * Registers every built-in extractor in an extractor registry.
 *
 * The registry is injected so consumers can add, replace, or disable
 * individual extractors.
 */
export function createDefaultExtractors(): readonly ExampleExtractor[] {
  return Object.freeze([
    createMarkdownExampleExtractor(),
    createSourceExampleExtractor(),
    createTestExampleExtractor(),
    createStorybookExampleExtractor(),
    createPlaygroundExampleExtractor(),
    createCliExampleExtractor(),
    createConfigurationExampleExtractor(),
    createFixtureExampleExtractor(),
    createExamplesDirectoryExampleExtractor(),
  ]);
}
