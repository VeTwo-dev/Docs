import type { EcosystemIntegration } from "../types.js";
export const mermaidIntegration: EcosystemIntegration = {
  id: "mermaid",
  packageName: "mermaid",
  description: "Diagram rendering with Mermaid",
  capabilities: ["diagrams", "flowcharts", "architecture-diagrams"],
  dependencies: [{ packageName: "mermaid", versionStrategy: "^10.0.0" }],
  async detect(context) {
    const hasArchitecture = context.projectKnowledge.architecture.modules.length > 1;
    return {
      detected: hasArchitecture,
      reason: hasArchitecture
        ? "Project has architecture worth diagramming"
        : "No architecture to diagram",
      confidence: hasArchitecture ? 0.8 : 0.2,
      evidence: hasArchitecture ? ["multiple modules"] : [],
    };
  },
  async generate() {
    return [];
  },
  async validate() {
    return { valid: true, errors: [], warnings: [] };
  },
};
