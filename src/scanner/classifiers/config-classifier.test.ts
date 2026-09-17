import { describe, expect, it } from "vitest";
import { classifyConfigFile, detectConfigFormat, detectConfigTools } from "./config-classifier.js";
import type { FileClassificationInput } from "./types.js";

function input(name: string, relativePath = name): FileClassificationInput {
  return { name, relativePath, extension: "" };
}

describe("detectConfigFormat", () => {
  it("detects formats", () => {
    expect(detectConfigFormat("x.json", ".json")).toBe("json");
    expect(detectConfigFormat("x.jsonc", ".jsonc")).toBe("jsonc");
    expect(detectConfigFormat("x.yaml", ".yaml")).toBe("yaml");
    expect(detectConfigFormat("x.toml", ".toml")).toBe("toml");
    expect(detectConfigFormat("x.ini", ".ini")).toBe("ini");
    expect(detectConfigFormat("x.config.ts", ".ts")).toBe("ts");
    expect(detectConfigFormat("x.config.js", ".js")).toBe("js");
    expect(detectConfigFormat(".eslintrc", "")).toBe("dotfile");
    expect(detectConfigFormat("x.weird", ".weird")).toBe("json");
  });
});

describe("classifyConfigFile", () => {
  it("detects known config files", () => {
    expect(classifyConfigFile(input("tsconfig.json"))).toEqual({
      tool: "typescript",
      format: "json",
    });
    expect(classifyConfigFile(input(".eslintrc.json"))).toEqual({ tool: "eslint", format: "json" });
    expect(classifyConfigFile(input("vite.config.ts"))).toEqual({ tool: "vite", format: "ts" });
    expect(classifyConfigFile(input("turbo.json"))).toEqual({ tool: "turbo", format: "json" });
    expect(classifyConfigFile(input("pnpm-lock.yaml"))).toEqual({
      tool: "lockfile",
      format: "yaml",
    });
    expect(classifyConfigFile(input("Dockerfile"))).toEqual({ tool: "docker", format: "dotfile" });
  });

  it("matches nested workflow files", () => {
    expect(classifyConfigFile(input("build.yml", ".github/workflows/build.yml"))).toEqual({
      tool: "github-actions",
      format: "yaml",
    });
  });

  it("returns null for non-config files", () => {
    expect(classifyConfigFile(input("index.ts"))).toBeNull();
    expect(classifyConfigFile(input("readme.md"))).toBeNull();
  });
});

describe("detectConfigTools", () => {
  it("returns the set of tools with config files", () => {
    const files = [
      { name: "tsconfig.json", relativePath: "tsconfig.json", extension: ".json" },
      { name: "vite.config.ts", relativePath: "vite.config.ts", extension: ".ts" },
      { name: "index.ts", relativePath: "index.ts", extension: ".ts" },
      { name: "README.md", relativePath: "README.md", extension: ".md" },
    ];
    const tools = detectConfigTools(files);
    expect(tools).toEqual(expect.arrayContaining(["typescript", "vite"]));
    expect(tools).toHaveLength(2);
  });

  it("skips non-config files cheaply", () => {
    const files = [
      { name: "index.ts", relativePath: "src/index.ts", extension: ".ts" },
      { name: "logo.png", relativePath: "public/logo.png", extension: ".png" },
      { name: "app.tsx", relativePath: "src/app.tsx", extension: ".tsx" },
    ];
    expect(detectConfigTools(files)).toEqual([]);
  });
});
