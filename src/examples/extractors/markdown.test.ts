import { describe, it, expect } from "vitest";
import { extractFencedBlocks, nearestHeading, createMarkdownExampleExtractor } from "./index.js";

const DOC = `# My Package

## Installation

\`\`\`bash
npm install my-package
\`\`\`

## Usage

\`\`\`ts
import { greet } from "my-package";
greet("world");
\`\`\`

Plain paragraph between.

~~~js
const x = 1;
~~~
`;

describe("extractFencedBlocks", () => {
  it("extracts backtick and tilde fences with languages", () => {
    const blocks = extractFencedBlocks(DOC);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.language).toBe("bash");
    expect(blocks[1]?.language).toBe("ts");
    expect(blocks[2]?.language).toBe("js");
    expect(blocks[1]?.content).toContain("import { greet }");
  });

  it("records accurate line numbers", () => {
    const blocks = extractFencedBlocks(DOC);
    expect(blocks[0]?.startLine).toBe(5);
    expect(blocks[0]?.endLine).toBe(7);
  });

  it("defaults to text for fences without info", () => {
    const blocks = extractFencedBlocks("```\ncode\n```");
    expect(blocks[0]?.language).toBe("text");
  });
});

describe("nearestHeading", () => {
  it("finds the heading above a line", () => {
    expect(nearestHeading(DOC, 5)).toBe("Installation");
    expect(nearestHeading(DOC, 12)).toBe("Usage");
  });

  it("returns undefined before any heading", () => {
    expect(nearestHeading("Plain intro text\n\n## Later\n", 1)).toBeUndefined();
    expect(nearestHeading("Plain intro text\n\n## Later\n", 3)).toBe("Later");
  });
});

describe("createMarkdownExampleExtractor", () => {
  const extractor = createMarkdownExampleExtractor();

  it("supports markdown files only", () => {
    expect(extractor.supports("README.md")).toBe(true);
    expect(extractor.supports("docs/guide.mdx")).toBe(true);
    expect(extractor.supports("src/index.ts")).toBe(false);
  });

  it("uses readme provenance for README files", () => {
    const raw = extractor.extract({
      path: "README.md",
      content: "# Hi\n\n```ts\nconst a = 1;\n```\n",
      knownPackages: ["my-package"],
    });
    expect(raw[0]?.provenance.kind).toBe("readme");
    expect(raw[0]?.provenance.context).toBe("Hi");
  });

  it("classifies shell blocks as cli hints", () => {
    const raw = extractor.extract({
      path: "docs/install.md",
      content: "```sh\nnpm i foo\n```\n",
    });
    expect(raw[0]?.typeHint).toBe("cli");
  });

  it("detects referenced packages from import statements", () => {
    const raw = extractor.extract({
      path: "README.md",
      content: '```ts\nimport { foo } from "my-package";\n```\n',
      knownPackages: ["my-package", "other"],
    });
    expect(raw[0]?.referencedPackages).toEqual(["my-package"]);
  });
});
