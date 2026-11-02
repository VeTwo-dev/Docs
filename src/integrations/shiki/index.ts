import type { EcosystemIntegration } from "../types.js";

export const shikiIntegration: EcosystemIntegration = {
  id: "shiki",
  packageName: "shiki",
  description: "Syntax highlighting with Shiki",
  capabilities: ["syntax-highlighting", "code-themes"],
  dependencies: [{ packageName: "shiki", versionStrategy: "^1.0.0" }],
  async detect() {
    return {
      detected: true,
      reason: "Always useful for code documentation",
      confidence: 1.0,
      evidence: ["project has code"],
    };
  },
  async generate() {
    return [];
  },
  async validate() {
    return { valid: true, errors: [], warnings: [] };
  },
};
