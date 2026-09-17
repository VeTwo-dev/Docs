import { describe, expect, it } from "vitest";
import { createLanguageModel } from "../models/language.js";
import {
  configurationFiles,
  entryPointFiles,
  matchesConfigurationFile,
  matchesEntryFile,
} from "./config.js";

const ts = createLanguageModel({
  metadata: {
    id: "typescript",
    displayName: "TypeScript",
    configFiles: ["tsconfig.json"],
    defaultEntryFiles: ["index.ts"],
    fileNames: ["tsconfig.json"],
  },
  capabilities: {},
  configuration: [{ files: ["tsconfig.json"] }],
});

const js = createLanguageModel({
  metadata: {
    id: "javascript",
    displayName: "JavaScript",
    configFiles: ["jsconfig.json"],
    defaultEntryFiles: ["index.js"],
  },
  capabilities: {},
});

describe("configurationFiles", () => {
  it("unions configuration files across languages", () => {
    expect(configurationFiles([ts, js])).toEqual(["tsconfig.json", "jsconfig.json"]);
    expect(configurationFiles([])).toEqual([]);
  });
});

describe("entryPointFiles", () => {
  it("unions entry files across languages", () => {
    expect(entryPointFiles([ts, js])).toEqual(["index.ts", "index.js"]);
  });
});

describe("matchesConfigurationFile", () => {
  it("matches via configFiles, fileNames and configuration models", () => {
    expect(matchesConfigurationFile("tsconfig.json", ts)).toBe(true);
    expect(matchesConfigurationFile("jsconfig.json", ts)).toBe(false);
  });
});

describe("matchesEntryFile", () => {
  it("matches declared entry files", () => {
    expect(matchesEntryFile("index.ts", ts)).toBe(true);
    expect(matchesEntryFile("index.js", ts)).toBe(false);
  });
});
