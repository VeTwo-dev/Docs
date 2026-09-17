export {
  createReferenceResolver,
  type ReferenceResolver,
  type ReferenceResolverHooks,
  type ReferenceResolverMetadata,
  type ReferenceResolverRegistryHandle,
} from "./resolver.js";
export {
  REFERENCE_RESOLVER_CAPABILITIES,
  isKnownReferenceCapability,
  type ReferenceCapabilityName,
  type ReferenceCapabilityValue,
  type ReferenceResolverCapabilities,
} from "./capabilities.js";
export type { ReferenceBindingInput, ReferenceResolutionOptions } from "./input.js";
export type { ReferenceBindingOutput, ReferenceBindingStatistics } from "./output.js";
