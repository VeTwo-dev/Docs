import type { DetectionSignal, DetectionResult } from "../contracts/detection.js";
import { deepFreeze } from "./freeze.js";

/** An immutable detection result model. */
export interface DetectionResultModel {
  /** The detected language id. */
  readonly languageId: string;
  /** Confidence score in `0..1`. */
  readonly confidence: number;
  /** The signals that contributed to this result. */
  readonly signals: readonly DetectionSignal[];
  /** Framework ids associated with the detected language. */
  readonly frameworks: readonly string[];
}

/** Clamps a confidence score into `0..1`. */
export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Builds an immutable detection result model. */
export function createDetectionResultModel(input: {
  readonly languageId: string;
  readonly confidence: number;
  readonly signals?: readonly DetectionSignal[];
  readonly frameworks?: readonly string[];
}): DetectionResultModel {
  return deepFreeze({
    languageId: input.languageId,
    confidence: clampConfidence(input.confidence),
    signals: input.signals !== undefined ? [...input.signals] : [],
    frameworks: input.frameworks !== undefined ? [...new Set(input.frameworks)] : [],
  });
}

/** Normalises a raw {@link DetectionResult} into an immutable model. */
export function detectionResultFromRaw(raw: DetectionResult): DetectionResultModel {
  return createDetectionResultModel(raw);
}
