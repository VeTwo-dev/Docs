/**
 * Integration Registry (Phase 23.2).
 *
 * Manages ecosystem integrations: register, resolve, detect, plan.
 * Deterministic, no filesystem access beyond what integrations declare.
 */

import type {
  EcosystemIntegration,
  IntegrationContext,
  IntegrationDetectionResult,
} from "./types.js";

export interface IntegrationRegistry {
  register(integration: EcosystemIntegration): void;
  unregister(id: string): void;
  get(id: string): EcosystemIntegration | undefined;
  list(): readonly EcosystemIntegration[];
  detectAll(context: IntegrationContext): Promise<Map<string, IntegrationDetectionResult>>;
}

export function createIntegrationRegistry(): IntegrationRegistry {
  const integrations = new Map<string, EcosystemIntegration>();

  return {
    register(integration: EcosystemIntegration): void {
      if (integrations.has(integration.id)) return;
      integrations.set(integration.id, integration);
    },
    unregister(id: string): void {
      integrations.delete(id);
    },
    get(id: string): EcosystemIntegration | undefined {
      return integrations.get(id);
    },
    list(): readonly EcosystemIntegration[] {
      return [...integrations.values()];
    },
    async detectAll(context: IntegrationContext): Promise<Map<string, IntegrationDetectionResult>> {
      const results = new Map<string, IntegrationDetectionResult>();
      for (const [id, integration] of integrations) {
        const result = await integration.detect(context);
        results.set(id, result);
      }
      return results;
    },
  };
}
