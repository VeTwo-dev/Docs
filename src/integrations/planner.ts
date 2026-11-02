/**
 * Integration Planner (Phase 23.2).
 *
 * Capability-driven planning: analyze project, detect which integrations
 * are useful, produce dependency and template plans.
 */

import type {
  EcosystemIntegration,
  IntegrationContext,
  IntegrationDetectionResult,
} from "./types.js";
import type { IntegrationRegistry } from "./registry.js";

export interface IntegrationPlan {
  readonly detected: Map<string, IntegrationDetectionResult>;
  readonly selected: readonly EcosystemIntegration[];
  readonly skipped: readonly { integration: EcosystemIntegration; reason: string }[];
  readonly dependencies: readonly { packageName: string; version: string }[];
}

export async function planIntegrations(
  registry: IntegrationRegistry,
  context: IntegrationContext,
): Promise<IntegrationPlan> {
  const detected = await registry.detectAll(context);
  const selected: EcosystemIntegration[] = [];
  const skipped: { integration: EcosystemIntegration; reason: string }[] = [];
  const dependencies: { packageName: string; version: string }[] = [];

  for (const integration of registry.list()) {
    const result = detected.get(integration.id);
    if (result?.detected) {
      selected.push(integration);
      for (const dep of integration.dependencies) {
        if (!dep.optional) {
          dependencies.push({ packageName: dep.packageName, version: dep.versionStrategy });
        }
      }
    } else {
      skipped.push({ integration, reason: result?.reason ?? "Not detected" });
    }
  }

  return { detected, selected, skipped, dependencies };
}
