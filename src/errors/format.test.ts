import { describe, it, expect } from "vitest";
import { formatError, formatCaughtError, formatGenericError } from "./format.js";
import { DocsError, BuildError, ConfigurationError } from "./classes.js";
import { ErrorCode } from "./codes.js";

describe("errors/format", () => {
  describe("formatError", () => {
    it("formats a DocsError with all fields", () => {
      const err = new DocsError({
        code: ErrorCode.SOURCE_NOT_FOUND,
        message: "Source directory does not exist",
        cause: new Error("ENOENT: no such file or directory"),
        suggestion: 'Create the "docs" directory or update the "source" config.',
        docsUrl: "https://github.com/vetwo/docs#configuration",
        file: "/project/docs.config.ts",
        configKey: 'source: "./docs"',
      });

      const output = formatError(err);

      expect(output).toContain("Source directory does not exist");
      expect(output).toContain("Source");
      expect(output).toContain("ENOENT");
      expect(output).toContain("/project/docs.config.ts");
      expect(output).toContain('source: "./docs"');
      expect(output).toContain("DOCS_SOURCE_NOT_FOUND");
      expect(output).toContain("https://github.com/vetwo/docs#configuration");
      expect(output).toContain("Create the");
    });

    it("formats a minimal DocsError", () => {
      const err = new DocsError({
        code: ErrorCode.INTERNAL_ERROR,
        message: "Something went wrong",
      });

      const output = formatError(err);

      expect(output).toContain("Something went wrong");
      expect(output).toContain("DOCS_INTERNAL_ERROR");
      expect(output).toContain("Suggestion");
    });

    it("includes stack trace in verbose mode", () => {
      const err = new BuildError({ message: "Build failed" });
      const output = formatError(err, true);

      expect(output).toContain("Stack Trace");
    });

    it("excludes stack trace in non-verbose mode", () => {
      const err = new BuildError({ message: "Build failed" });
      const output = formatError(err, false);

      expect(output).not.toContain("Stack Trace");
    });

    it("uses correct error name", () => {
      const err = new ConfigurationError({ message: "Bad config" });
      const output = formatError(err);

      expect(output).toContain("ConfigurationError");
    });

    it("shows generic 'Error' name for base DocsError", () => {
      const err = new DocsError({
        code: ErrorCode.INTERNAL_ERROR,
        message: "test",
      });
      const output = formatError(err);

      expect(output).toContain("Error");
    });
  });

  describe("formatCaughtError", () => {
    it("formats a DocsError directly", () => {
      const err = new BuildError({ message: "Build failed" });
      const output = formatCaughtError(err, "Build failed");

      expect(output).toContain("Build failed");
    });

    it("wraps a regular Error", () => {
      const err = new Error("something broke");
      const output = formatCaughtError(err, "Build failed");

      expect(output).toContain("Build failed");
      expect(output).toContain("something broke");
    });

    it("wraps a non-Error value", () => {
      const output = formatCaughtError("string error", "Build failed");

      expect(output).toContain("Build failed");
      expect(output).toContain("string error");
    });
  });

  describe("formatGenericError", () => {
    it("formats an Error", () => {
      const err = new Error("something broke");
      const output = formatGenericError("Build failed", err);

      expect(output).toContain("Build failed");
      expect(output).toContain("something broke");
      expect(output).toContain("Suggestion");
      expect(output).toContain("Error Code");
    });

    it("formats a non-Error value", () => {
      const output = formatGenericError("Build failed", "string error");

      expect(output).toContain("Build failed");
      expect(output).toContain("string error");
    });

    it("includes stack trace in verbose mode", () => {
      const err = new Error("test");
      const output = formatGenericError("Test", err, true);

      expect(output).toContain("Stack Trace");
    });

    it("excludes stack trace in non-verbose mode", () => {
      const err = new Error("test");
      const output = formatGenericError("Test", err, false);

      expect(output).not.toContain("Stack Trace");
    });
  });
});
