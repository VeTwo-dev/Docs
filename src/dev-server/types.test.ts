import { describe, it, expect } from "vitest";
import { DEFAULT_DEV_SERVER_CONFIG } from "./types.js";

describe("DevServerConfig", () => {
  it("has correct defaults", () => {
    expect(DEFAULT_DEV_SERVER_CONFIG.port).toBe(3000);
    expect(DEFAULT_DEV_SERVER_CONFIG.host).toBe("localhost");
    expect(DEFAULT_DEV_SERVER_CONFIG.open).toBe(false);
    expect(DEFAULT_DEV_SERVER_CONFIG.extraWatch).toEqual([]);
  });
});
