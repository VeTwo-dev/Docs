import { describe, expect, it } from "vitest";
import {
  classifyFile,
  hasBenchmarkMarker,
  hasStoryMarker,
  hasTestMarker,
  isConfigFileName,
  isDocumentationName,
  isGeneratedFile,
} from "./file-classifier.js";
import type { FileClassificationInput } from "./types.js";

function classify(name: string, relativePath = name): ReturnType<typeof classifyFile> {
  const input: FileClassificationInput = { name, relativePath, extension: getExt(relativePath) };
  return classifyFile(input);
}

function getExt(p: string): string {
  const last = p.split("/").pop() ?? p;
  const dot = last.lastIndexOf(".");
  return dot <= 0 ? "" : last.slice(dot);
}

describe("classifyFile", () => {
  it("classifies source files", () => {
    expect(classify("index.ts").category).toBe("source");
    expect(classify("app.tsx").category).toBe("source");
    expect(classify("main.py").category).toBe("source");
    expect(classify("mod.rs").category).toBe("source");
  });

  it("classifies declaration files", () => {
    expect(classify("types.d.ts")).toMatchObject({
      category: "declaration",
      language: "typescript",
    });
    expect(classify("types.d.mts").category).toBe("declaration");
  });

  it("classifies test files", () => {
    expect(classify("index.test.ts").category).toBe("test");
    expect(classify("index.spec.ts").category).toBe("test");
    expect(classify("index.e2e.ts").category).toBe("test");
    expect(classify("__tests__/index.ts").category).toBe("test");
    expect(classify("src/__mocks__/thing.ts").category).toBe("test");
  });

  it("classifies story and benchmark files", () => {
    expect(classify("Button.stories.tsx").category).toBe("story");
    expect(classify("stories/Button.tsx").category).toBe("story");
    expect(classify("sort.bench.ts").category).toBe("benchmark");
    expect(classify("bench/quick.ts").category).toBe("benchmark");
  });

  it("classifies documentation", () => {
    expect(classify("README.md").category).toBe("documentation");
    expect(classify("intro.mdx").category).toBe("documentation");
    expect(classify("CHANGELOG.md").category).toBe("documentation");
    expect(classify("docs/intro.rst").category).toBe("documentation");
    expect(classify("LICENSE").category).toBe("documentation");
  });

  it("classifies scripts and styles", () => {
    expect(classify("run.sh").category).toBe("script");
    expect(classify("Makefile").category).toBe("script");
    expect(classify("Dockerfile").category).toBe("script");
    expect(classify("styles.css").category).toBe("style");
    expect(classify("styles.scss").category).toBe("style");
  });

  it("classifies configuration files", () => {
    expect(classify("tsconfig.json").category).toBe("config");
    expect(classify("package.json").category).toBe("config");
    expect(classify(".eslintrc.json").category).toBe("config");
    expect(classify(".env").category).toBe("config");
    expect(classify("config.yaml").category).toBe("config");
    expect(classify("vite.config.ts").category).toBe("source");
  });

  it("classifies assets", () => {
    expect(classify("logo.png").category).toBe("asset");
    expect(classify("hero.svg").category).toBe("asset");
    expect(classify("font.woff2").category).toBe("asset");
  });

  it("classifies generated, cache and temporary files", () => {
    expect(classify("bundle.js.map")).toMatchObject({ category: "generated", generated: true });
    expect(classify("tsconfig.tsbuildinfo").category).toBe("cache");
    expect(classify(".eslintcache").category).toBe("cache");
    expect(classify("file.tmp").category).toBe("temporary");
    expect(classify("file.swp").category).toBe("temporary");
  });

  it("classifies snapshots", () => {
    expect(classify("__snapshots__/x.snap").category).toBe("snapshot");
    expect(classify("x.snap").category).toBe("snapshot");
  });

  it("classifies data documents", () => {
    expect(classify("data.txt").category).toBe("asset");
    expect(classify("table.csv").category).toBe("asset");
  });

  it("falls back to unknown", () => {
    expect(classify("random.xyz").category).toBe("unknown");
  });
});

describe("markers", () => {
  it("hasTestMarker", () => {
    expect(hasTestMarker("a.test.ts")).toBe(true);
    expect(hasTestMarker("a.ts")).toBe(false);
  });
  it("hasStoryMarker", () => {
    expect(hasStoryMarker("a.stories.tsx")).toBe(true);
    expect(hasStoryMarker("a.tsx")).toBe(false);
  });
  it("hasBenchmarkMarker", () => {
    expect(hasBenchmarkMarker("a.bench.ts")).toBe(true);
    expect(hasBenchmarkMarker("a.ts")).toBe(false);
  });
});

describe("isDocumentationName", () => {
  it("matches known documentation names", () => {
    expect(isDocumentationName("README.md")).toBe(true);
    expect(isDocumentationName("CONTRIBUTING.md")).toBe(true);
    expect(isDocumentationName("LICENSE")).toBe(true);
    expect(isDocumentationName("index.ts")).toBe(false);
  });
});

describe("isConfigFileName", () => {
  it("matches config names", () => {
    expect(isConfigFileName(".eslintrc.json")).toBe(true);
    expect(isConfigFileName(".prettierrc.yml")).toBe(true);
    expect(isConfigFileName(".yarnrc.yaml")).toBe(true);
    expect(isConfigFileName(".env")).toBe(true);
    expect(isConfigFileName(".gitignore")).toBe(true);
    expect(isConfigFileName("vite.config.ts")).toBe(false);
    expect(isConfigFileName(".gitkeep")).toBe(false);
  });
});

describe("isGeneratedFile", () => {
  it("detects generated output", () => {
    expect(isGeneratedFile("app.min.js", ".js")).toBe(true);
    expect(isGeneratedFile("app.bundle.css", ".css")).toBe(true);
    expect(isGeneratedFile("x.map", ".map")).toBe(true);
    expect(isGeneratedFile("app.js", ".js")).toBe(false);
  });
});
