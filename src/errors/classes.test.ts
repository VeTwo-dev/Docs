import { describe, it, expect } from "vitest";
import {
  DocsError,
  ConfigurationError,
  ValidationError,
  BuildError,
  PluginError,
  ThemeError,
  RendererError,
  MarkdownError,
  SearchError,
  TypeDocError,
  PagefindError,
  CacheError,
  CliError,
  InternalError,
} from "./classes.js";
import { ErrorCode } from "./codes.js";

describe("errors/classes", () => {
  describe("DocsError", () => {
    it("creates with all options", () => {
      const cause = new Error("root cause");
      const err = new DocsError({
        code: ErrorCode.BUILD_FAILED,
        message: "Build failed",
        cause,
        suggestion: "Check config",
        docsUrl: "https://example.com",
        file: "src/index.ts",
        line: 10,
        column: 5,
        configKey: 'source: "./docs"',
        hint: "Try again",
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DocsError);
      expect(err.code).toBe(ErrorCode.BUILD_FAILED);
      expect(err.message).toBe("Build failed");
      expect(err.cause).toBe(cause);
      expect(err.suggestion).toBe("Check config");
      expect(err.docsUrl).toBe("https://example.com");
      expect(err.file).toBe("src/index.ts");
      expect(err.line).toBe(10);
      expect(err.column).toBe(5);
      expect(err.configKey).toBe('source: "./docs"');
      expect(err.hint).toBe("Try again");
      expect(err.name).toBe("DocsError");
      expect(err.recoverable).toBe(false);
    });

    it("creates with minimal options", () => {
      const err = new DocsError({
        code: ErrorCode.INTERNAL_ERROR,
        message: "Something went wrong",
      });

      expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(err.message).toBe("Something went wrong");
      expect(err.cause).toBeUndefined();
      expect(err.suggestion).toBeUndefined();
      expect(err.file).toBeUndefined();
      expect(err.recoverable).toBe(false);
    });

    it("has a stack trace", () => {
      const err = new DocsError({
        code: ErrorCode.BUILD_FAILED,
        message: "test",
      });
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain("DocsError");
    });
  });

  describe("ConfigurationError", () => {
    it("sets code to CONFIG_INVALID", () => {
      const err = new ConfigurationError({
        message: "Invalid config",
        configKey: "title",
      });
      expect(err.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(err.name).toBe("ConfigurationError");
      expect(err.configKey).toBe("title");
    });
  });

  describe("ValidationError", () => {
    it("sets code to CONFIG_INVALID", () => {
      const err = new ValidationError({
        message: "Schema validation failed",
      });
      expect(err.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(err.name).toBe("ValidationError");
    });
  });

  describe("BuildError", () => {
    it("defaults to BUILD_FAILED code", () => {
      const err = new BuildError({ message: "Build failed" });
      expect(err.code).toBe(ErrorCode.BUILD_FAILED);
      expect(err.name).toBe("BuildError");
    });

    it("accepts custom code", () => {
      const err = new BuildError({
        code: ErrorCode.SOURCE_NOT_FOUND,
        message: "Source not found",
      });
      expect(err.code).toBe(ErrorCode.SOURCE_NOT_FOUND);
    });
  });

  describe("PluginError", () => {
    it("defaults to PLUGIN_ERROR code", () => {
      const err = new PluginError({ message: "Plugin failed" });
      expect(err.code).toBe(ErrorCode.PLUGIN_ERROR);
      expect(err.name).toBe("PluginError");
    });

    it("accepts custom code", () => {
      const err = new PluginError({
        code: ErrorCode.PLUGIN_NOT_FOUND,
        message: "Plugin not found",
      });
      expect(err.code).toBe(ErrorCode.PLUGIN_NOT_FOUND);
    });
  });

  describe("ThemeError", () => {
    it("defaults to THEME_ERROR code", () => {
      const err = new ThemeError({ message: "Theme failed" });
      expect(err.code).toBe(ErrorCode.THEME_ERROR);
      expect(err.name).toBe("ThemeError");
    });
  });

  describe("RendererError", () => {
    it("defaults to RENDER_ERROR code", () => {
      const err = new RendererError({ message: "Render failed" });
      expect(err.code).toBe(ErrorCode.RENDER_ERROR);
      expect(err.name).toBe("RendererError");
    });
  });

  describe("MarkdownError", () => {
    it("defaults to MARKDOWN_ERROR code", () => {
      const err = new MarkdownError({ message: "MD parse failed" });
      expect(err.code).toBe(ErrorCode.MARKDOWN_ERROR);
      expect(err.name).toBe("MarkdownError");
    });

    it("accepts custom code", () => {
      const err = new MarkdownError({
        code: ErrorCode.MARKDOWN_PARSE_ERROR,
        message: "Parse error",
      });
      expect(err.code).toBe(ErrorCode.MARKDOWN_PARSE_ERROR);
    });
  });

  describe("SearchError", () => {
    it("is recoverable", () => {
      const err = new SearchError({ message: "Search failed" });
      expect(err.code).toBe(ErrorCode.SEARCH_ERROR);
      expect(err.recoverable).toBe(true);
    });
  });

  describe("TypeDocError", () => {
    it("is recoverable", () => {
      const err = new TypeDocError({ message: "TypeDoc failed" });
      expect(err.code).toBe(ErrorCode.TYPESDOC_FAILED);
      expect(err.recoverable).toBe(true);
    });
  });

  describe("PagefindError", () => {
    it("is recoverable", () => {
      const err = new PagefindError({ message: "Pagefind failed" });
      expect(err.code).toBe(ErrorCode.PAGEFIND_FAILED);
      expect(err.recoverable).toBe(true);
    });
  });

  describe("CacheError", () => {
    it("is recoverable", () => {
      const err = new CacheError({ message: "Cache failed" });
      expect(err.code).toBe(ErrorCode.CACHE_ERROR);
      expect(err.recoverable).toBe(true);
    });
  });

  describe("CliError", () => {
    it("defaults to CLI_COMMAND_FAILED code", () => {
      const err = new CliError({ message: "Command failed" });
      expect(err.code).toBe(ErrorCode.CLI_COMMAND_FAILED);
      expect(err.name).toBe("CliError");
    });
  });

  describe("InternalError", () => {
    it("sets code to INTERNAL_ERROR", () => {
      const err = new InternalError({ message: "Internal" });
      expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(err.name).toBe("InternalError");
      expect(err.recoverable).toBe(false);
    });
  });

  describe("error hierarchy", () => {
    it("all subclasses are instanceof DocsError", () => {
      const errors = [
        new ConfigurationError({ message: "c" }),
        new ValidationError({ message: "v" }),
        new BuildError({ message: "b" }),
        new PluginError({ message: "p" }),
        new ThemeError({ message: "t" }),
        new RendererError({ message: "r" }),
        new MarkdownError({ message: "m" }),
        new SearchError({ message: "s" }),
        new TypeDocError({ message: "td" }),
        new PagefindError({ message: "pf" }),
        new CacheError({ message: "cache" }),
        new CliError({ message: "cli" }),
        new InternalError({ message: "int" }),
      ];

      for (const err of errors) {
        expect(err).toBeInstanceOf(DocsError);
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});
