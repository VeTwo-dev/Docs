import { describe, expect, it } from "vitest";
import { classifyAssetFile } from "./asset-classifier.js";
import type { FileClassificationInput } from "./types.js";

function input(name: string, extension: string): FileClassificationInput {
  return { name, relativePath: name, extension };
}

describe("classifyAssetFile", () => {
  it("classifies known asset extensions", () => {
    expect(classifyAssetFile(input("logo.png", ".png"))).toBe("image");
    expect(classifyAssetFile(input("font.woff2", ".woff2"))).toBe("font");
    expect(classifyAssetFile(input("clip.mp4", ".mp4"))).toBe("video");
    expect(classifyAssetFile(input("song.mp3", ".mp3"))).toBe("audio");
    expect(classifyAssetFile(input("icon.ico", ".ico"))).toBe("icon");
    expect(classifyAssetFile(input("vector.svg", ".svg"))).toBe("svg");
    expect(classifyAssetFile(input("doc.pdf", ".pdf"))).toBe("document");
    expect(classifyAssetFile(input("bundle.zip", ".zip"))).toBe("archive");
  });

  it("matches case-insensitively", () => {
    expect(classifyAssetFile(input("logo.PNG", ".PNG"))).toBe("image");
  });

  it("returns null for non-assets", () => {
    expect(classifyAssetFile(input("index.ts", ".ts"))).toBeNull();
  });
});
