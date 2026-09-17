import { describe, it, expect } from "vitest";
import {
  DEFAULT_NAME,
  STAR_NAME,
  isProjectSpecifier,
  nameParts,
  referenceId,
  resolveSpecifierToFile,
} from "./index.js";

const ROOT = "/project";

describe("referenceId", () => {
  it("builds stable ids from kind, source and discriminator", () => {
    expect(referenceId("import", "m1", "", "./x", 3)).toBe("ref:import:m1::./x:3");
    expect(referenceId("import-name", "m1", "a", "./x", 0)).toBe("ref:import-name:m1:a:./x:0");
  });

  it("exposes the reserved names", () => {
    expect(DEFAULT_NAME).toBe("default");
    expect(STAR_NAME).toBe("*");
  });
});

describe("isProjectSpecifier", () => {
  it("accepts relative specifiers and rejects bare ones", () => {
    expect(isProjectSpecifier("./x")).toBe(true);
    expect(isProjectSpecifier("../y")).toBe(true);
    expect(isProjectSpecifier(".")).toBe(true);
    expect(isProjectSpecifier("..")).toBe(true);
    expect(isProjectSpecifier("lodash")).toBe(false);
    expect(isProjectSpecifier("@scope/pkg")).toBe(false);
    expect(isProjectSpecifier("node:fs")).toBe(false);
  });
});

describe("nameParts", () => {
  it("splits dotted names and drops empty segments", () => {
    expect(nameParts("NS.Type")).toEqual(["NS", "Type"]);
    expect(nameParts("point")).toEqual(["point"]);
    expect(nameParts("a..b")).toEqual(["a", "b"]);
  });
});

describe("resolveSpecifierToFile", () => {
  it("resolves relative specifiers against the known files", () => {
    expect(
      resolveSpecifierToFile(ROOT, "src/a.ts", "./point", [".ts"], new Set(["src/point.ts"])),
    ).toBe("src/point.ts");
  });

  it("returns undefined for unknown files and bare specifiers", () => {
    expect(
      resolveSpecifierToFile(ROOT, "src/a.ts", "./missing", [".ts"], new Set(["src/point.ts"])),
    ).toBeUndefined();
    expect(
      resolveSpecifierToFile(ROOT, "src/a.ts", "lodash", [".ts"], new Set(["src/point.ts"])),
    ).toBeUndefined();
  });

  it("tries directory index candidates", () => {
    expect(
      resolveSpecifierToFile(ROOT, "src/a.ts", "./lib", [".ts"], new Set(["src/lib/index.ts"])),
    ).toBe("src/lib/index.ts");
  });
});
