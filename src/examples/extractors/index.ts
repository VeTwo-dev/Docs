export type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
export { provenance } from "./extractor.js";
export { createMarkdownExampleExtractor } from "./markdown.js";
export { extractFencedBlocks, nearestHeading } from "./markdown.js";
export { createSourceExampleExtractor } from "./source.js";
export { extractDocExamples } from "./source.js";
export { createTestExampleExtractor } from "./tests.js";
export { extractTestCases } from "./tests.js";
export { createStorybookExampleExtractor } from "./storybook.js";
export { extractStories } from "./storybook.js";
export {
  createPlaygroundExampleExtractor,
  isPlaygroundPath,
  PLAYGROUND_DIRS,
} from "./playground.js";
export { createCliExampleExtractor } from "./cli.js";
export { parseCliCommand, extractCliBlocks } from "./cli.js";
export {
  createConfigurationExampleExtractor,
  detectKeys,
  KNOWN_CONFIG_KEYS,
} from "./configuration.js";
export { createFixtureExampleExtractor, isFixturePath, FIXTURE_DIR_NAMES } from "./fixtures.js";
export {
  createExamplesDirectoryExampleExtractor,
  isExamplesPath,
  EXAMPLE_DIR_NAMES,
} from "./examples-directory.js";

/** All built-in extractors, registered by default. */
export { createDefaultExtractors } from "./registry-default.js";
