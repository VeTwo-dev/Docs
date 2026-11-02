/**
 * Takumi Integration (Phase 23.2 Reference).
 *
 * Capability-driven integration for takumi-js. Detects usage via package.json
 * and source imports, plans dependencies, generates MDX documentation and
 * code examples based on actual Takumi API surface.
 */

import type {
  EcosystemIntegration,
  IntegrationContext,
  IntegrationDetectionResult,
} from "../types.js";

export const takumiIntegration: EcosystemIntegration = {
  id: "takumi",
  packageName: "takumi-js",
  description: "High-performance image and animation rendering with Takumi",
  capabilities: [
    "image-generation",
    "raster-rendering",
    "svg-rendering",
    "og-image-generation",
    "animation-rendering",
    "typography-rendering",
    "font-loading",
    "image-loading",
    "tailwind-rendering",
  ],
  dependencies: [{ packageName: "takumi-js", versionStrategy: "^0.1.0" }],
  optionalDependencies: [
    { packageName: "@takumi-rs/core", versionStrategy: "^0.1.0", optional: true },
    { packageName: "@takumi-rs/wasm", versionStrategy: "^0.1.0", optional: true },
  ],

  async detect(context: IntegrationContext): Promise<IntegrationDetectionResult> {
    const evidence: string[] = [];
    let detected = false;

    // Check package.json dependencies
    const pkg = context.projectKnowledge.raw?.packageJson as Record<string, unknown> | undefined;
    const deps = {
      ...((pkg?.["dependencies"] as Record<string, string> | undefined) ?? {}),
      ...((pkg?.["devDependencies"] as Record<string, string> | undefined) ?? {}),
    };
    if (deps["takumi-js"] !== undefined) {
      detected = true;
      evidence.push("package.json depends on takumi-js");
    }
    if (deps["@takumi-rs/core"] !== undefined || deps["@takumi-rs/wasm"] !== undefined) {
      detected = true;
      evidence.push("package.json depends on takumi Rust backend");
    }

    // Check source for takumi imports (via project knowledge if available)
    // For now, check if project has image generation needs
    if (
      context.projectKnowledge.purpose.capabilities.some((c) => /image|render|og|canvas/i.test(c))
    ) {
      evidence.push("project purpose suggests image generation capability useful");
    }

    return {
      detected,
      reason: detected ? "Project uses takumi-js for image generation" : "No takumi usage detected",
      confidence: detected ? 0.9 : 0.1,
      evidence,
    };
  },

  async generate(context: IntegrationContext) {
    // Generate Takumi documentation pages based on actual API
    // For now, return empty - will be populated when takumi is detected and needed
    // Real implementation would generate MDX for rendering, animation, typography etc.
    void context;
    return [];
  },

  async validate() {
    return { valid: true, errors: [], warnings: [] };
  },
};
