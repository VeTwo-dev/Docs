import { describe, expect, it } from "vitest";
import { createFrameworkAssociationModel } from "./framework.js";

describe("createFrameworkAssociationModel", () => {
  it("normalises optional dependency lists and freezes", () => {
    const model = createFrameworkAssociationModel({
      id: "nextjs",
      name: "Next.js",
      dependencies: ["next"],
    });
    expect(model.id).toBe("nextjs");
    expect(model.name).toBe("Next.js");
    expect(model.dependencies).toEqual(["next"]);
    expect(model.entryFiles).toEqual([]);
    expect(model.requires).toEqual([]);
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("copies entryFiles and requires arrays", () => {
    const model = createFrameworkAssociationModel({
      id: "react",
      name: "React",
      entryFiles: ["main.jsx"],
      requires: ["typescript"],
    });
    expect(model.entryFiles).toEqual(["main.jsx"]);
    expect(model.requires).toEqual(["typescript"]);
  });
});
