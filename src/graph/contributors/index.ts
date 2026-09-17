import { structuralContributor } from "./structural.js";
import { referencesContributor } from "./references.js";

/**
 * The built-in graph contributors, in registration order. Registered by
 * default by {@link import("../engine/index.js").createGraphEngine}.
 */
export const builtinContributors = [structuralContributor, referencesContributor] as const;

export * from "./structural.js";
export * from "./references.js";
