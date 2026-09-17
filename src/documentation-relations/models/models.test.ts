import { describe, it, expect } from "vitest";
import {
  createDocumentationRelationship,
  inverseRelationshipKind,
  isRelationshipKind,
  createLearningPath,
  isLearningAudience,
  isReaderStage,
  isHardCycle,
} from "./index.js";

describe("createDocumentationRelationship", () => {
  it("builds a frozen relationship with stable id", () => {
    const relationship = createDocumentationRelationship({
      from: "guide/install",
      to: "guide/usage",
      kind: "nextStep",
      label: "Next: Usage",
      evidence: ["ordered after install"],
      confidence: 0.9,
      source: "planner",
    });
    expect(relationship.id).toMatch(/^rel:/);
    expect(Object.isFrozen(relationship)).toBe(true);
    expect(Object.isFrozen(relationship.evidence)).toBe(true);
  });

  it("defaults confidence and weight", () => {
    const relationship = createDocumentationRelationship({
      from: "a",
      to: "b",
      kind: "relatedTo",
      label: "Related",
      source: "test",
    });
    expect(relationship.confidence).toBe(0.7);
    expect(relationship.weight).toBe(0.5);
  });
});

describe("inverseRelationshipKind / isRelationshipKind", () => {
  it("maps inverse kinds", () => {
    expect(inverseRelationshipKind("nextStep")).toBe("previousStep");
    expect(inverseRelationshipKind("uses")).toBe("usedBy");
    expect(inverseRelationshipKind("relatedTo")).toBeUndefined();
  });

  it("recognizes the union", () => {
    expect(isRelationshipKind("troubleshoots")).toBe(true);
    expect(isRelationshipKind("bogus")).toBe(false);
  });
});

describe("createLearningPath", () => {
  it("builds an ordered path", () => {
    const path = createLearningPath({
      title: "Getting started",
      audience: "Beginner",
      steps: [
        { page: "overview", stage: "discover", label: "Overview" },
        { page: "install", stage: "install", label: "Install" },
      ],
    });
    expect(path.steps[0]?.position).toBe(1);
    expect(path.steps[1]?.position).toBe(2);
    expect(Object.isFrozen(path)).toBe(true);
  });
});

describe("guards", () => {
  it("recognizes audiences and stages", () => {
    expect(isLearningAudience("Plugin Author")).toBe(true);
    expect(isLearningAudience("Nobody")).toBe(false);
    expect(isReaderStage("troubleshoot")).toBe(true);
    expect(isReaderStage("nope")).toBe(false);
  });

  it("classifies hard vs soft cycles", () => {
    const hard = { severity: "hard" as const, relationshipIds: [], pages: [], kind: "nextStep" };
    expect(isHardCycle(hard)).toBe(true);
  });
});
