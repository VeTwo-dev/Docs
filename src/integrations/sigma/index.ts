import type { EcosystemIntegration } from "../types.js";
export const sigmaIntegration: EcosystemIntegration = {
  id: "sigma",
  packageName: "sigma",
  description: "Graph visualization with Sigma.js",
  capabilities: ["graph-visualization", "interactive-graph"],
  dependencies: [
    { packageName: "sigma", versionStrategy: "^3.0.0" },
    { packageName: "graphology", versionStrategy: "^0.26.0" },
  ],
  async detect(context) {
    const hasGraph =
      context.projectKnowledge.graph !== undefined ||
      context.projectKnowledge.architecture.modules.length > 2;
    return {
      detected: hasGraph,
      reason: hasGraph ? "Project has graph relationships" : "No graph to visualize",
      confidence: hasGraph ? 0.7 : 0.3,
      evidence: hasGraph ? ["knowledge graph exists"] : [],
    };
  },
  async generate() {
    return [];
  },
  async validate() {
    return { valid: true, errors: [], warnings: [] };
  },
};
