import { describe, expect, it } from "vitest";
import {
  detectEncoding,
  detectLanguage,
  detectMimeType,
  isTextExtension,
  MIME_BY_EXTENSION,
} from "./extensions.js";

describe("detectLanguage", () => {
  it("maps extensions to languages", () => {
    expect(detectLanguage(".ts")).toBe("typescript");
    expect(detectLanguage(".mdx")).toBe("mdx");
    expect(detectLanguage(".py")).toBe("python");
    expect(detectLanguage(".unknownxyz")).toBe("unknown");
  });
});

describe("detectMimeType", () => {
  it("maps extensions to mime types", () => {
    expect(detectMimeType(".png")).toBe(MIME_BY_EXTENSION[".png"]);
    expect(detectMimeType(".unknownxyz")).toBeUndefined();
  });
});

describe("isTextExtension", () => {
  it("recognises text extensions", () => {
    expect(isTextExtension(".ts")).toBe(true);
    expect(isTextExtension(".png")).toBe(false);
  });
});

describe("detectEncoding", () => {
  it("detects binary vs utf8", () => {
    expect(detectEncoding(".ts")).toBe("utf8");
    expect(detectEncoding(".png")).toBe("binary");
  });
});
