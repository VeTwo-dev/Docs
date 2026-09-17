import { describe, expect, it } from "vitest";
import { createCapabilityModel } from "./capabilities.js";

describe("createCapabilityModel", () => {
  it("drops undefined entries and freezes the map", () => {
    const model = createCapabilityModel({
      scanning: true,
      compilation: "full",
      custom: undefined,
    });
    expect(model.scanning).toBe(true);
    expect(model.compilation).toBe("full");
    expect("custom" in model).toBe(false);
    expect(Object.isFrozen(model)).toBe(true);
  });
});
