import { describe, it, expect } from "vitest";
import { redact, isSecretConfigKey, sanitizeConfigValue } from "./redact.js";

describe("redact", () => {
  it("redacts OpenAI API keys", () => {
    expect(redact("Using key sk-abc123def456ghi789jkl0")).toContain("[REDACTED]");
    expect(redact("Using key sk-abc123def456ghi789jkl0")).not.toContain("sk-abc123");
  });

  it("redacts GitHub tokens", () => {
    // ghp_ + 36 alphanumeric chars = standard GitHub PAT format
    expect(redact("Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")).toContain("[REDACTED]");
  });

  it("redacts AWS keys", () => {
    expect(redact("AWS: AKIAIOSFODNN7EXAMPLE")).toContain("[REDACTED]");
  });

  it("redacts private keys", () => {
    const text = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----";
    expect(redact(text)).toBe("[REDACTED]");
  });

  it("redacts database URLs", () => {
    expect(redact("postgres://user:password@localhost/db")).toContain("[REDACTED]");
  });

  it("does not redact normal text", () => {
    expect(redact("Hello world")).toBe("Hello world");
  });

  it("supports custom patterns", () => {
    expect(redact("CODE: xyz-123", { extraPatterns: [/xyz-\d+/g] })).toBe("CODE: [REDACTED]");
  });

  it("supports custom replacement", () => {
    expect(redact("sk-abc123def456ghi789jkl0", { replacement: "***" })).toBe("***");
  });
});

describe("isSecretConfigKey", () => {
  it("detects apiKey", () => {
    expect(isSecretConfigKey("apiKey")).toBe(true);
  });

  it("detects secretKey", () => {
    expect(isSecretConfigKey("secretKey")).toBe(true);
  });

  it("detects password", () => {
    expect(isSecretConfigKey("password")).toBe(true);
  });

  it("detects token", () => {
    expect(isSecretConfigKey("token")).toBe(true);
  });

  it("does not flag normal keys", () => {
    expect(isSecretConfigKey("title")).toBe(false);
    expect(isSecretConfigKey("name")).toBe(false);
    expect(isSecretConfigKey("enabled")).toBe(false);
  });
});

describe("sanitizeConfigValue", () => {
  it("masks secret values", () => {
    expect(sanitizeConfigValue("apiKey", "sk-abc123")).toBe("[REDACTED]");
  });

  it("passes through normal values", () => {
    expect(sanitizeConfigValue("title", "My Docs")).toBe("My Docs");
  });
});
