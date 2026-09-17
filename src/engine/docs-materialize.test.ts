import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Logger } from "../types/internal.js";
import { materializeDocumentation } from "./docs-materialize.js";
import { validateWorkspace } from "../documentation/compiler/validate-output.js";
import { defineDocs } from "../config/define.js";

const noop: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  success: () => {},
  spin: () => ({ start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {} }),
  progress: () => {},
  box: () => {},
  table: () => {},
};

const FIXTURE = join(tmpdir(), "vetwo-materialize-e2e");

function write(rel: string, content: string): void {
  const target = join(FIXTURE, rel);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content, "utf8");
}

describe("docs materialize end-to-end", () => {
  beforeAll(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
    // Fixture A: small TypeScript library
    write("package.json", JSON.stringify({ name: "fixture-lib", version: "1.0.0", description: "Fixture", scripts: { build: "tsup", test: "vitest run" } }));
    write("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2020", module: "ESNext", strict: true } }));
    write("src/index.ts", `/** Adds two numbers. @param a - first @param b - second @returns sum */\nexport function add(a: number, b: number): number { return a + b; }\n`);
    write("src/cli.ts", `/** CLI entry. */\nexport const command = "build";\n`);
    // Fixture D: asset (tiny PNG header)
    write("assets/logo.png", "PNG");
  });

  afterAll(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
  });

  it("materializes isolated next/md/static with manifest, search and ownership", async () => {
    const config = defineDocs({
      title: "Fixture",
      description: "Fixture docs",
      source: "./src",
      output: { directory: "./docs", layout: { next: true, markdown: true, static: true } },
    });
    const result = await materializeDocumentation(FIXTURE, config, noop);

    expect(result.errors).toEqual([]);

    // Boundaries: no renderer writes into another root.
    const nextFiles = result.written.filter((p) => p.includes(`${"next"}${"/"}`));
    expect(nextFiles.every((p) => !p.includes("/md/") && !p.includes("/static/"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/next/package.json"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/next/app/docs/[[...slug]]/page.tsx"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/next/app/globals.css"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/md"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/static/index.html"))).toBe(true);
    expect(existsSync(join(FIXTURE, "docs/static/assets/css/globals.css"))).toBe(true);

    // Manifest + search are pure JSON.
    const manifest = JSON.parse(readFileSync(join(FIXTURE, "docs/manifest.json"), "utf8"));
    expect(Array.isArray(manifest.pages)).toBe(true);
    expect(manifest.pages.length).toBeGreaterThan(0);
    const search = JSON.parse(readFileSync(join(FIXTURE, "docs/search-index.json"), "utf8"));
    expect(Array.isArray(search.entries)).toBe(true);

    // Fixture E: user-owned file preserved on regeneration.
    const userFile = join(FIXTURE, "docs/md/introduction.mdx");
    if (existsSync(userFile)) {
      writeFileSync(userFile, "# Custom intro\n\nUser content.\n", "utf8");
      const second = await materializeDocumentation(FIXTURE, config, noop);
      expect(readFileSync(userFile, "utf8")).toContain("User content.");
      expect(second.warnings.some((w) => w.includes("Preserving user-owned"))).toBe(true);
    }

    // Workspace validation passes on the generated output.
    const validation = validateWorkspace(FIXTURE, join(FIXTURE, "docs"));
    expect(validation.errors).toEqual([]);
  }, 120000);
});
