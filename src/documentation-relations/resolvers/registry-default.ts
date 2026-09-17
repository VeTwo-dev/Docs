import type { RelationshipResolver } from "./resolver.js";
import { createSharedEntityResolver } from "./shared-entity.js";
import { createApiResolver } from "./api.js";
import { createConfigurationResolver } from "./configuration.js";
import { createPageDependencyResolver } from "./page-dependency.js";
import { createWorkflowResolver } from "./workflow.js";
import { createExampleResolver } from "./example.js";

/**
 * Registers every built-in relationship resolver.
 *
 * The registry is injected so consumers can add, replace, or disable
 * individual resolvers.
 */
export function createDefaultRelationshipResolvers(): readonly RelationshipResolver[] {
  return Object.freeze([
    createSharedEntityResolver(),
    createApiResolver(),
    createConfigurationResolver(),
    createPageDependencyResolver(),
    createWorkflowResolver(),
    createExampleResolver(),
  ]);
}
