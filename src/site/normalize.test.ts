/**
 * Normalization regression tests: page description derivation.
 *
 * The canonical pipeline derives a page description from the first
 * paragraph (max 160 characters). The truncation must respect word
 * boundaries so generated descriptions never end mid-word.
 */

import { describe, expect, it } from "vitest";
import { normalizeDocument } from "./normalize.js";

const nowhere = "/fixtures/nowhere/does-not-exist";

function htmlWithParagraph(paragraph: string): string {
  return `# Title\n\n${paragraph}\n`;
}

describe("description derivation", () => {
  it("keeps short paragraphs verbatim", () => {
    const doc = normalizeDocument({
      absolutePath: nowhere,
      relativePath: "guide/short.md",
      raw: htmlWithParagraph("A short description."),
    });
    expect(doc.description).toBe("A short description.");
  });

  it("truncates long paragraphs at a word boundary", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i + 1}`).join(" ");
    const doc = normalizeDocument({
      absolutePath: nowhere,
      relativePath: "guide/long.md",
      raw: htmlWithParagraph(words),
    });
    expect(doc.description.length).toBeLessThanOrEqual(160);
    expect(doc.description.endsWith("word16")).toBe(true);
    // The next word cannot appear partially.
    expect(doc.description).not.toMatch(/word17/);
    expect(doc.description.endsWith(" ")).toBe(false);
  });

  it("strips inline markdown from derived descriptions", () => {
    const doc = normalizeDocument({
      absolutePath: nowhere,
      relativePath: "guide/rich.md",
      raw: htmlWithParagraph(
        "Uses `docs.config.ts` and **bold claims** with a [link](target.md) inside.",
      ),
    });
    expect(doc.description).toBe(
      "Uses docs.config.ts and bold claims with a link inside.",
    );
  });
});
