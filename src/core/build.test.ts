import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./index.js";
import type { Logger } from "../types/internal.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    spin: vi.fn(() => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      stop: vi.fn(),
      text: "",
    })),
    progress: vi.fn(),
    box: vi.fn(),
    table: vi.fn(),
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "build-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("build", () => {
  it("builds documentation from a project with markdown files", async () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", version: "1.0.0" }));

    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Welcome\n\nHello world.");
    writeFileSync(join(docsDir, "guide.md"), "# Guide\n\nSome guide content.");

    const logger = createMockLogger();

    await build({ rootDir: tmpDir, logger });

    expect(logger.info).toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalled();
  }, 30_000);

  it("uses default config when no configPath provided", async () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", version: "1.0.0" }));

    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Index\n\nContent.");

    const logger = createMockLogger();

    await build({ rootDir: tmpDir, logger });

    expect(logger.success).toHaveBeenCalled();
  }, 30_000);

  it("reports doc files count", async () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", version: "1.0.0" }));

    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Index\n\nContent.");
    writeFileSync(join(docsDir, "guide.md"), "# Guide\n\nContent.");

    const logger = createMockLogger();

    await build({ rootDir: tmpDir, logger });

    const infoCalls = vi.mocked(logger.info).mock.calls.map((c) => c[0]);
    expect(infoCalls.some((msg) => typeof msg === "string" && msg.includes("Doc files:"))).toBe(
      true,
    );
  }, 30_000);

  it("reports source files count", async () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", version: "1.0.0" }));
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "index.ts"), "export const x = 1;");

    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Index\n\nContent.");

    const logger = createMockLogger();

    await build({ rootDir: tmpDir, logger });

    const infoCalls = vi.mocked(logger.info).mock.calls.map((c) => c[0]);
    expect(infoCalls.some((msg) => typeof msg === "string" && msg.includes("Source files:"))).toBe(
      true,
    );
  }, 30_000);

  it("createsBuildContext is exported", async () => {
    const { createBuildContext } = await import("./index.js");
    expect(typeof createBuildContext).toBe("function");
  });
});
