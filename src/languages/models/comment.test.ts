import { describe, expect, it } from "vitest";
import { createCommentStandardModel } from "./comment.js";

describe("createCommentStandardModel", () => {
  it("normalises a single style into an array", () => {
    const model = createCommentStandardModel({
      id: "jsdoc",
      name: "JSDoc",
      style: "docblock",
      markers: ["/**"],
      description: "JSDoc comments",
    });
    expect(model.style).toEqual(["docblock"]);
    expect(model.markers).toEqual(["/**"]);
    expect(model.description).toBe("JSDoc comments");
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("keeps multiple styles and defaults markers", () => {
    const model = createCommentStandardModel({
      id: "doxygen",
      name: "Doxygen",
      style: ["block", "line"],
    });
    expect(model.style).toEqual(["block", "line"]);
    expect(model.markers).toEqual([]);
  });
});
