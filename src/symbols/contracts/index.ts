export {
  createSymbolExtractor,
  type SymbolExtractor,
  type SymbolExtractorHooks,
  type SymbolExtractorMetadata,
  type SymbolExtractorRegistryHandle,
} from "./extractor.js";
export {
  isKnownSymbolCapability,
  KNOWN_SYMBOL_CAPABILITIES,
  type KnownSymbolCapability,
  type SymbolCapabilityValue,
  type SymbolExtractorCapabilities,
} from "./capabilities.js";
export type { SymbolExtractionInput, SymbolExtractionOptions } from "./input.js";
export type { SymbolExtractionOutput, SymbolExtractionStatistics } from "./output.js";
