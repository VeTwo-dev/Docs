import { describe, expect, it } from "vitest";
import {
  CODE_MIME_TYPES,
  extensionOf,
  fileNameOf,
  matchesExtension,
  mimeOfExtension,
  normalizeExtension,
} from "./extension.js";

describe("normalizeExtension", () => {
  it("ensures a leading dot and lowercases", () => {
    expect(normalizeExtension("TS")).toBe(".ts");
    expect(normalizeExtension(".TS")).toBe(".ts");
    expect(normalizeExtension(".ts")).toBe(".ts");
    expect(normalizeExtension("")).toBe("");
  });
});

describe("extensionOf", () => {
  it("extracts the extension from a basename or path", () => {
    expect(extensionOf("index.ts")).toBe(".ts");
    expect(extensionOf("src/foo/bar.jsx")).toBe(".jsx");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".env")).toBe("");
  });
});

describe("fileNameOf", () => {
  it("returns the basename", () => {
    expect(fileNameOf("a/b/c.txt")).toBe("c.txt");
    expect(fileNameOf("index.ts")).toBe("index.ts");
  });
});

describe("mimeOfExtension", () => {
  it("maps known code extensions", () => {
    expect(mimeOfExtension(".ts")).toBe("application/typescript");
    expect(mimeOfExtension("js")).toBe("application/javascript");
  });

  it("falls back to text/plain", () => {
    expect(mimeOfExtension(".xyz")).toBe("text/plain");
  });
});

describe("matchesExtension", () => {
  it("matches case-insensitively with or without leading dot", () => {
    expect(matchesExtension(".ts", [".ts", ".js"])).toBe(true);
    expect(matchesExtension("TS", [".ts"])).toBe(true);
    expect(matchesExtension(".rb", [".ts", ".js"])).toBe(false);
  });
});

describe("CODE_MIME_TYPES", () => {
  it("covers common languages", () => {
    expect(CODE_MIME_TYPES[".py"]).toBe("text/x-python");
    expect(CODE_MIME_TYPES[".go"]).toBe("text/x-go");
  });
});
