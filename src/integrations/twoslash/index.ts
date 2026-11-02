import type { EcosystemIntegration } from "../types.js";
export const twoslashIntegration: EcosystemIntegration = {
  id: "twoslash",
  packageName: "@shikijs/twoslash",
  description: "TypeScript type information with Twoslash",
  capabilities: ["typescript-type-information", "inline-type-errors"],
  dependencies: [{ packageName: "@shikijs/twoslash", versionStrategy: "^1.0.0" }],
  async detect(context) {
    const isTS =
      context.projectKnowledge.identity.language === "typescript" ||
      context.projectKnowledge.identity.language === "mixed";
    return {
      detected: isTS,
      reason: isTS ? "TypeScript project benefits from Twoslash" : "No TypeScript",
      confidence: isTS ? 0.85 : 0.1,
      evidence: isTS ? ["TypeScript detected"] : [],
    };
  },
  async generate() {
    return [];
  },
  async validate() {
    return { valid: true, errors: [], warnings: [] };
  },
};
