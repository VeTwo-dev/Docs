/**
 * Regeneration, ownership and safety tests for the canonical materializer.
 *
 * These run against a throwaway fixture corpus in a temporary directory —
 * never against the real `md/` source — and assert the properties the
 * self-hosting workflow depends on:
 *
 * - the authored source is never modified,
 * - repeated generation is idempotent (no duplicated pages),
 * - user-owned files in the output directory survive regeneration,
 * - removing a source page removes its generated counterpart,
 * - heading anchors and `#fragment` links resolve in the static target.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineDocs } from "../config/define.js";
import { materializeDocumentation } from "../engine/docs-materialize.js";
import type { Logger } from "../types/internal.js";

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  success: () => undefined,
  spin: () => ({ text: () => undefined, stop: () => undefined, succeed: () => undefined }) as never,
  progress: () => undefined,
  box: () => undefined,
  table: () => undefined,
};

function listFiles(dir: string, base: string = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split("\\").join("/"));
  }
  return out.sort();
}

let root: string;
let sourceDir: string;
let outputDir: string;

function write(relativePath: string, contents: string): void {
  const full = join(root, relativePath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "vetwo-docs-fixture-"));
  sourceDir = join(root, "md");
  outputDir = join(root, "out");
  mkdirSync(sourceDir, { recursive: true });

  write(
    "md/index.md",
    [
      "# Fixture Home",
      "",
      "Welcome to the fixture site.",
      "",
      "See [Start](guide/start.md).",
      "",
    ].join("\n"),
  );
  write(
    "md/guide/start.md",
    [
      "# Start",
      "",
      "Go to [Advanced](advanced.md) or jump to [Details](#details).",
      "",
      "## Details",
      "",
      "The details section exists as a heading anchor.",
      "",
    ].join("\n"),
  );
  write("md/guide/advanced.md", ["# Advanced", "", "Back to [Start](start.md).", ""].join("\n"));
}, 60_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeConfig() {
  return defineDocs({
    title: "Fixture Docs",
    description: "Fixture documentation site.",
    source: "./md",
    content: { pipeline: "canonical" },
    output: {
      directory: "./out",
      layout: { next: false, markdown: true, static: true, site: false },
    },
    api: { enabled: false },
    markdown: { extension: ".md" },
  });
}

describe("canonical materialization", () => {
  it("materializes the fixture corpus without touching the source", async () => {
    const before = listFiles(sourceDir);
    const beforeContents = before.map((f) => readFileSync(join(sourceDir, f), "utf8"));

    await materializeDocumentation(root, makeConfig(), silentLogger);

    expect(listFiles(sourceDir)).toEqual(before);
    for (const [i, file] of before.entries()) {
      expect(readFileSync(join(sourceDir, file), "utf8")).toBe(beforeContents[i]);
    }
  });

  it("renders the fixture pages into Markdown and static HTML", async () => {
    expect(existsSync(join(outputDir, "md", "guide", "start.md"))).toBe(true);
    expect(existsSync(join(outputDir, "static", "guide", "start", "index.html"))).toBe(true);
    expect(existsSync(join(outputDir, "static", "index.html"))).toBe(true);
  });

  it("resolves heading anchors and #fragment links in the static target", async () => {
    const html = readFileSync(join(outputDir, "static", "guide", "start", "index.html"), "utf8");
    // The heading carries an id, so `#details` resolves.
    expect(html).toMatch(/<h2[^>]*id="details"/);
    // The authored fragment link survives into the rendered link.
    expect(html).toContain("#details");
  });

  it("is idempotent: a second generation neither duplicates nor drops pages", async () => {
    const first = listFiles(outputDir);
    await materializeDocumentation(root, makeConfig(), silentLogger);
    const second = listFiles(outputDir);
    expect(second).toEqual(first);
  });

  it("preserves user-owned files that the generator does not own", async () => {
    const userFile = join(outputDir, "static", "notes.txt");
    writeFileSync(userFile, "hand-written", "utf8");

    await materializeDocumentation(root, makeConfig(), silentLogger);

    expect(existsSync(userFile)).toBe(true);
    expect(readFileSync(userFile, "utf8")).toBe("hand-written");
  });

  it("removes the generated counterpart of a deleted source page", async () => {
    const advancedHtml = join(outputDir, "static", "guide", "advanced", "index.html");
    expect(existsSync(advancedHtml)).toBe(true);

    rmSync(join(sourceDir, "guide", "advanced.md"), { force: true });
    await materializeDocumentation(root, makeConfig(), silentLogger);

    expect(existsSync(advancedHtml)).toBe(false);
  });
});
