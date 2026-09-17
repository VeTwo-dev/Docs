import type { SearchEntry, SearchIndex } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { writeFile } from "../filesystem/index.js";
import { join } from "node:path";
import { DEFAULT_SEARCH_INDEX_FILE } from "../constants/defaults.js";
import MiniSearch from "minisearch";

/** Configuration for the MiniSearch instance. */
interface SearchEngineOptions {
  readonly fields: readonly string[];
  readonly storeFields: readonly string[];
}

const DEFAULT_ENGINE_OPTIONS: SearchEngineOptions = {
  fields: ["title", "content", "category"],
  storeFields: ["id", "title", "url", "category"],
};

/**
 * Strips HTML tags from a string and normalizes whitespace.
 *
 * @param html - The HTML string to clean.
 * @returns The plain text content.
 *
 * @example
 * ```ts
 * stripHtml("<p>Hello <strong>world</strong></p>");
 * // => "Hello world"
 * ```
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncates text to a maximum length, preserving word boundaries.
 *
 * @param text - The text to truncate.
 * @param maxLength - Maximum character count.
 * @returns The truncated text.
 *
 * @example
 * ```ts
 * truncate("Hello world this is long", 10);
 * // => "Hello world"
 * ```
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

/**
 * Creates a MiniSearch index configured for documentation search.
 *
 * @param options - Optional engine configuration overrides.
 * @returns A configured MiniSearch instance.
 *
 * @example
 * ```ts
 * const index = createSearchEngine();
 * index.add({ id: "1", title: "Getting Started", content: "Welcome...", category: "guides", url: "/guides/start" });
 * const results = index.search("welcome");
 * ```
 */
export function createSearchEngine(options?: Partial<SearchEngineOptions>) {
  const opts = { ...DEFAULT_ENGINE_OPTIONS, ...options };
  return new MiniSearch({
    fields: [...opts.fields],
    storeFields: [...opts.storeFields],
    searchOptions: {
      boost: { title: 2, category: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

/**
 * Generates a search index from the pages in the build context.
 *
 * When `config.search.engine` is `"pagefind"`, skips MiniSearch generation
 * and sets metadata only — Pagefind will index the HTML output separately
 * via the `pagefind` pipeline feature.  If the engine is `"minisearch"` (the
 * default), builds a JSON search index using MiniSearch.
 *
 * @param ctx - The mutable build context containing pages.
 *
 * @example
 * ```ts
 * generateSearchIndex(ctx);
 * ```
 */
export async function generateSearchIndex(ctx: BuildContextMutable): Promise<void> {
  const engineChoice = ctx.config.search.engine;

  if (engineChoice === "pagefind") {
    // Pagefind indexes HTML files directly — no JSON index needed here.
    // The actual Pagefind CLI invocation happens in the pagefind pipeline
    // feature, which runs after the output stage writes HTML files.
    (ctx as { searchIndex: SearchIndex }).searchIndex = {
      entries: [],
      generatedAt: new Date().toISOString(),
      engine: "pagefind",
    };
    return;
  }

  const searchEngine = createSearchEngine();

  const entries: SearchEntry[] = ctx.pages.map((page) => {
    const plainContent = stripHtml(page.content);
    const entry: SearchEntry = {
      id: page.id,
      title: page.title,
      content: truncate(plainContent, 500),
      url: page.slug,
      category: page.category,
    };

    searchEngine.add({
      id: page.id,
      title: page.title,
      content: plainContent,
      category: page.category,
      url: page.slug,
    });

    return entry;
  });

  (ctx as { searchIndex: SearchIndex }).searchIndex = {
    entries,
    generatedAt: new Date().toISOString(),
    engine: "minisearch",
  };
}

/**
 * Writes the generated search index to the output directory as a JSON file.
 *
 * @param ctx - The mutable build context containing the search index.
 *
 * @example
 * ```ts
 * writeSearchIndex(ctx);
 * ```
 */
export function writeSearchIndex(ctx: BuildContextMutable): void {
  if (!ctx.searchIndex) return;
  const outputPath = join(ctx.outputDir, DEFAULT_SEARCH_INDEX_FILE);
  writeFile(outputPath, JSON.stringify(ctx.searchIndex, null, 2));
}
