import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDocsEngine } from "../src/engine/index.js";
import { createLoggerSync } from "../src/logger/index.js";

const TEMP_DIR = join(tmpdir(), "docs-engine-cwd-test");

describe("engine rootDir fallback", () => {
  beforeAll(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    mkdirSync(join(TEMP_DIR, "src"), { recursive: true });
    writeFileSync(
      join(TEMP_DIR, "package.json"),
      JSON.stringify({ name: "cwd-test", version: "1.0.0" }),
    );
    writeFileSync(join(TEMP_DIR, "src", "index.md"), "# Welcome\n\nHello.\n");
  });

  afterAll(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("falls back to process.cwd() when no rootDir is provided", async () => {
    const previousCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const engine = createDocsEngine({ logger: createLoggerSync() });
      const result = await engine.initialize();
      expect(result.config).toBeDefined();
      await engine.dispose();
    } finally {
      process.chdir(previousCwd);
    }
  });
});
