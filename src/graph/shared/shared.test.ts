import { describe, it, expect } from "vitest";
import { knowledgeEdgeId, describeEdgeKind, describeNodeKind } from "./index.js";

describe("knowledgeEdgeId", () => {
  it("is deterministic and pure", () => {
    expect(knowledgeEdgeId("m:a", "imports", "m:point")).toBe("m:a|imports|m:point");
    expect(knowledgeEdgeId("m:a", "imports", "m:point")).toBe(
      knowledgeEdgeId("m:a", "imports", "m:point"),
    );
    expect(knowledgeEdgeId("m:a", "exports", "m:point")).toBe("m:a|exports|m:point");
  });
});

describe("describeEdgeKind / describeNodeKind", () => {
  it("labels every edge kind", () => {
    expect(describeEdgeKind("owns")).toBe("owns");
    expect(describeEdgeKind("declared-in")).toBe("declared in");
    expect(describeEdgeKind("imports")).toBe("imports");
    expect(describeEdgeKind("imports-name")).toBe("imports name");
    expect(describeEdgeKind("exports")).toBe("exports");
    expect(describeEdgeKind("re-exports")).toBe("re-exports");
    expect(describeEdgeKind("references")).toBe("references");
  });

  it("labels node kinds and unknown kinds verbatim", () => {
    expect(describeNodeKind("module")).toBe("module");
    expect(describeEdgeKind("unknown" as never)).toBe("unknown");
  });
});
