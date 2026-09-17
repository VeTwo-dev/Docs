export { EXAMPLE_TYPES, EXAMPLE_PROVENANCE_KINDS, EXAMPLE_VALIDATION_STATUSES } from "./type.js";
export type {
  ExampleType,
  ExampleProvenanceKind,
  ExampleValidationStatus,
  ExampleClassificationFlags,
} from "./type.js";
export { isExampleType, isExampleProvenanceKind } from "./type.js";
export { createExampleProvenance } from "./provenance.js";
export type { ExampleProvenance, ExampleProvenanceInput, ExampleLocation } from "./provenance.js";
export { createExample } from "./example.js";
export type { Example, ExampleInput } from "./example.js";
export { createExampleGap } from "./gap.js";
export type { ExampleGap, ExampleGapInput } from "./gap.js";
export { groupDuplicates, isDuplicateSignature, signatureOf } from "./duplicate.js";
export type { DuplicateGroup, ExampleSignature } from "./duplicate.js";
