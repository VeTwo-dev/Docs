import { describe, expect, it } from "vitest";
import { mapBlockText, rewriteMarkdownLinks } from "./links.js";
import type { IRBlock } from "../documentation/compiler/ir.js";

describe("rewriteMarkdownLinks", () => {
  it("rewrites plain Markdown links", () => {
    expect(rewriteMarkdownLinks("See [cli](cli.md).", () => "/cli")).toBe("See [cli](/cli).");
  });

  it("preserves a link title", () => {
    expect(rewriteMarkdownLinks('[a](a.md "Title")', () => "/a")).toBe('[a](/a "Title")');
  });

  it("rewrites links whose label contains an inline code span", () => {
    expect(rewriteMarkdownLinks("[`docs plugin`](../cli/plugin.md)", () => "/cli/plugin")).toBe(
      "[`docs plugin`](/cli/plugin)",
    );
  });

  it("leaves links inside inline code spans untouched", () => {
    const text = "Use `[x](x.md)` verbatim.";
    expect(rewriteMarkdownLinks(text, () => "/x")).toBe(text);
  });

  it("leaves unresolved links untouched", () => {
    const text = "[missing](missing.md)";
    expect(rewriteMarkdownLinks(text, () => undefined)).toBe(text);
  });

  it("does not rewrite image syntax", () => {
    const text = "![alt](img.md)";
    expect(rewriteMarkdownLinks(text, () => "/img")).toBe(text);
  });
});

describe("mapBlockText", () => {
  it("transforms paragraph, heading, list, callout and table text", () => {
    const blocks: IRBlock[] = [
      { kind: "paragraph", text: "p" },
      { kind: "heading", level: 2, text: "h" },
      { kind: "list", ordered: false, items: ["a", "b"] },
      { kind: "callout", tone: "note", text: "c" },
      { kind: "table", headers: ["h1"], rows: [["r1"]] },
    ];
    const out = mapBlockText(blocks, (text) => text.toUpperCase());
    expect(out).toEqual([
      { kind: "paragraph", text: "P" },
      { kind: "heading", level: 2, text: "H" },
      { kind: "list", ordered: false, items: ["A", "B"] },
      { kind: "callout", tone: "note", text: "C" },
      { kind: "table", headers: ["H1"], rows: [["R1"]] },
    ]);
  });
});
