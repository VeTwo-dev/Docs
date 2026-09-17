import { describe, expect, it } from "vitest";
import { createResourceFilter, shouldCollectKind, shouldIncludeResource } from "./resource.js";
import type { ResourceKind } from "../types/categories.js";

describe("createResourceFilter", () => {
  it("copies option arrays", () => {
    const include = ["src/**"];
    const filter = createResourceFilter({ include });
    include.push("extra");
    expect(filter.include).toEqual(["src/**"]);
  });

  it("omits unset options", () => {
    const filter = createResourceFilter({});
    expect(filter.include).toBeUndefined();
    expect(filter.exclude).toBeUndefined();
    expect(filter.maxDepth).toBeUndefined();
  });
});

describe("shouldIncludeResource", () => {
  it("includes everything with no filters", () => {
    expect(shouldIncludeResource("src/a.ts", false, 1, {})).toBe(true);
  });

  it("enforces include patterns", () => {
    const filter = createResourceFilter({ include: ["src/**"] });
    expect(shouldIncludeResource("src/a.ts", false, 1, filter)).toBe(true);
    expect(shouldIncludeResource("lib/b.ts", false, 1, filter)).toBe(false);
  });

  it("enforces exclude patterns", () => {
    const filter = createResourceFilter({ exclude: ["**/*.test.ts"] });
    expect(shouldIncludeResource("src/a.ts", false, 1, filter)).toBe(true);
    expect(shouldIncludeResource("src/a.test.ts", false, 1, filter)).toBe(false);
  });

  it("enforces maxDepth", () => {
    const filter = createResourceFilter({ maxDepth: 1 });
    expect(shouldIncludeResource("a.ts", false, 0, filter)).toBe(true);
    expect(shouldIncludeResource("a/b.ts", false, 1, filter)).toBe(true);
    expect(shouldIncludeResource("a/b/c.ts", false, 2, filter)).toBe(false);
  });

  it("applies include before exclude", () => {
    const filter = createResourceFilter({ include: ["src/**"], exclude: ["src/private/**"] });
    expect(shouldIncludeResource("src/private/x.ts", false, 2, filter)).toBe(false);
    expect(shouldIncludeResource("src/x.ts", false, 1, filter)).toBe(true);
  });
});

describe("shouldCollectKind", () => {
  it("collects everything when unspecified", () => {
    expect(shouldCollectKind("file" as ResourceKind, {})).toBe(true);
  });

  it("respects resourceKinds", () => {
    const filter = createResourceFilter({ resourceKinds: ["directory", "file"] });
    expect(shouldCollectKind("file", filter)).toBe(true);
    expect(shouldCollectKind("package" as ResourceKind, filter)).toBe(false);
  });
});
