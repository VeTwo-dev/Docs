import { describe, it, expect } from "vitest";
import { ErrorCode, ERROR_DESCRIPTIONS } from "./codes.js";

describe("errors/codes", () => {
  it("has all expected error codes", () => {
    const expectedKeys = [
      "CONFIG_INVALID",
      "SOURCE_NOT_FOUND",
      "BUILD_FAILED",
      "TYPESCRIPT_ERROR",
      "MARKDOWN_ERROR",
      "MARKDOWN_PARSE_ERROR",
      "PLUGIN_ERROR",
      "PLUGIN_NOT_FOUND",
      "THEME_ERROR",
      "THEME_NOT_FOUND",
      "RENDER_ERROR",
      "SEARCH_ERROR",
      "SEARCH_INDEX_FAILED",
      "PAGEFIND_FAILED",
      "CACHE_ERROR",
      "CACHE_READ_FAILED",
      "CACHE_WRITE_FAILED",
      "OUTPUT_ERROR",
      "OUTPUT_WRITE_FAILED",
      "SITEMAP_FAILED",
      "RSS_FAILED",
      "OG_IMAGE_FAILED",
      "TYPESDOC_FAILED",
      "TYPESDOC_CONFIG_ERROR",
      "DEVSERVER_ERROR",
      "CLI_INVALID_ARGS",
      "CLI_COMMAND_FAILED",
      "INTERNAL_ERROR",
    ];

    for (const key of expectedKeys) {
      expect(ErrorCode).toHaveProperty(key);
      expect(typeof ErrorCode[key as keyof typeof ErrorCode]).toBe("string");
    }
  });

  it("all codes start with DOCS_", () => {
    for (const [, value] of Object.entries(ErrorCode)) {
      expect(value).toMatch(/^DOCS_/);
    }
  });

  it("has descriptions for all error codes", () => {
    for (const [, value] of Object.entries(ErrorCode)) {
      expect(ERROR_DESCRIPTIONS).toHaveProperty(value);
      expect(typeof ERROR_DESCRIPTIONS[value as keyof typeof ERROR_DESCRIPTIONS]).toBe("string");
    }
  });

  it("descriptions are non-empty strings", () => {
    for (const desc of Object.values(ERROR_DESCRIPTIONS)) {
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});
