import { describe, it, expect } from "vitest";
import { hasDocumentationTag, parseDocumentationComment } from "./doc.js";

describe("parseDocumentationComment", () => {
  it("parses a summary without tags", () => {
    const doc = parseDocumentationComment("/** A point on a plane. */", "tsdoc");
    expect(doc.summary).toBe("A point on a plane.");
    expect(doc.tags).toEqual([]);
    expect(doc.text).toBe("/** A point on a plane. */");
    expect(doc.format).toBe("tsdoc");
  });

  it("parses @param with a name and description", () => {
    const doc = parseDocumentationComment(
      "/**\n * Sums values.\n * @param a - the first value\n * @param b the second value\n * @returns sum\n */",
      "tsdoc",
    );
    expect(doc.summary).toBe("Sums values.");
    expect(doc.tags).toEqual([
      { tag: "param", name: "a", text: "the first value" },
      { tag: "param", name: "b", text: "the second value" },
      { tag: "returns", name: "sum" },
    ]);
  });

  it("parses one tag per line", () => {
    const doc = parseDocumentationComment("/**\n * @internal\n * @deprecated\n */", "tsdoc");
    expect(doc.tags).toEqual([{ tag: "internal" }, { tag: "deprecated" }]);
  });

  it("keeps text for tags whose body is not an identifier", () => {
    const doc = parseDocumentationComment("/** @see https://example.com */", "jsdoc");
    expect(doc.tags).toEqual([{ tag: "see", text: "https://example.com" }]);
  });

  it("handles bare tags and tags with only names", () => {
    const doc = parseDocumentationComment("/** @deprecated */", "tsdoc");
    expect(doc.tags).toEqual([{ tag: "deprecated" }]);
    expect(doc.summary).toBeUndefined();
  });

  it("keeps summary text as the part before the first tag", () => {
    const doc = parseDocumentationComment(
      "/**\n * first line\n * second line\n * @internal\n */",
      "plain",
    );
    expect(doc.summary).toBe("first line second line");
    expect(doc.tags).toEqual([{ tag: "internal" }]);
  });

  it("does not treat non-identifier words as tag names", () => {
    const doc = parseDocumentationComment("/** @see https://example.com */", "jsdoc");
    expect(doc.tags).toEqual([{ tag: "see", text: "https://example.com" }]);
  });
});

describe("hasDocumentationTag", () => {
  const doc = parseDocumentationComment("/**\n * @internal\n * @deprecated\n */", "tsdoc");

  it("finds a declared tag", () => {
    expect(hasDocumentationTag(doc, "internal")).toBe(true);
    expect(hasDocumentationTag(doc, "deprecated")).toBe(true);
  });

  it("rejects undeclared tags and undefined comments", () => {
    expect(hasDocumentationTag(doc, "generated")).toBe(false);
    expect(hasDocumentationTag(undefined, "internal")).toBe(false);
  });
});
