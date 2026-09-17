import type {
  ExampleExtractor,
  ExampleExtractionInput,
  RawExample,
} from "../extractors/extractor.js";

/**
 * The example extractor registry — a plugin system.
 *
 * Extractors are registered by id, queried by id, listed, and invoked via
 * `extract`, which routes each file to the extractors that `supports` it.
 */
export interface ExampleExtractorRegistry {
  register(extractor: ExampleExtractor): { readonly extractorId: string };
  unregister(id: string): boolean;
  get(id: string): ExampleExtractor | undefined;
  list(): readonly ExampleExtractor[];
  /** Extractors that support a given path. */
  supports(path: string, content?: string): readonly ExampleExtractor[];
  /** Run every matching extractor over a file, concatenating raw examples. */
  extract(input: ExampleExtractionInput): readonly RawExample[];
  readonly size: number;
}

/** Creates a new empty {@link ExampleExtractorRegistry}. */
export function createExampleExtractorRegistry(): ExampleExtractorRegistry {
  const byId = new Map<string, ExampleExtractor>();

  return {
    get size(): number {
      return byId.size;
    },

    register(extractor: ExampleExtractor): { readonly extractorId: string } {
      byId.set(extractor.id, extractor);
      return { extractorId: extractor.id };
    },

    unregister(id: string): boolean {
      return byId.delete(id);
    },

    get(id: string): ExampleExtractor | undefined {
      return byId.get(id);
    },

    list(): readonly ExampleExtractor[] {
      return Object.freeze([...byId.values()]);
    },

    supports(path: string, content?: string): readonly ExampleExtractor[] {
      const matching = [...byId.values()].filter((extractor) => extractor.supports(path, content));
      return Object.freeze(matching);
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const results: RawExample[] = [];
      for (const extractor of this.supports(input.path, input.content)) {
        results.push(...extractor.extract(input));
      }
      return Object.freeze(results);
    },
  };
}
