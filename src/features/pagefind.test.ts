import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuildContextMutable } from "../types/internal.js";
import { defineDocs } from "../config/define.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("which-pm-runs", () => ({
  whichPMRuns: vi.fn(() => ({ name: "npm" })),
}));

import { execa } from "execa";
import { whichPMRuns } from "which-pm-runs";
import { generatePagefindIndex } from "./pagefind.js";

function createMockCtx(overrides?: Partial<BuildContextMutable>): BuildContextMutable {
  return {
    config: defineDocs(),
    rootDir: "/tmp/test",
    sourceDir: "./src",
    outputDir: "/tmp/test/output",
    projectType: "library",
    packageManager: "npm",
    workspaceInfo: undefined,
    packages: [],
    sourceFiles: [],
    pages: [],
    navItems: [],
    sidebarGroups: [],
    searchIndex: undefined,
    apiDocs: [],
    sitemapEntries: [],
    rssEntries: [],
    errors: [],
    warnings: [],
    startTime: Date.now(),
    ...overrides,
  };
}

describe("generatePagefindIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls execa with npx by default for npm", async () => {
    vi.mocked(execa).mockResolvedValue({} as never);

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await generatePagefindIndex(ctx);

    expect(execa).toHaveBeenCalledWith(
      "npx",
      ["pagefind", "--site", "/tmp/test/output", "--output-dir", "/tmp/test/output/_pagefind"],
      { timeout: 30_000, stdio: "pipe" },
    );
  });

  it("uses yarn when package manager is yarn", async () => {
    vi.mocked(whichPMRuns).mockReturnValue({ name: "yarn" } as never);
    vi.mocked(execa).mockResolvedValue({} as never);

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await generatePagefindIndex(ctx);

    expect(execa).toHaveBeenCalledWith(
      "yarn",
      ["pagefind", "--site", "/tmp/test/output", "--output-dir", "/tmp/test/output/_pagefind"],
      { timeout: 30_000, stdio: "pipe" },
    );
  });

  it("uses npx when whichPMRuns returns null", async () => {
    vi.mocked(whichPMRuns).mockReturnValue(null as never);
    vi.mocked(execa).mockResolvedValue({} as never);

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await generatePagefindIndex(ctx);

    expect(execa).toHaveBeenCalledWith(
      "npx",
      expect.any(Array),
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  it("swallows execa errors and falls back to MiniSearch", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("command not found"));

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await expect(generatePagefindIndex(ctx)).resolves.toBeUndefined();
  });

  it("handles non-Error rejection values gracefully", async () => {
    vi.mocked(execa).mockRejectedValue("string error");

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await expect(generatePagefindIndex(ctx)).resolves.toBeUndefined();
  });

  it("is non-fatal: search falls back to MiniSearch", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("fail"));

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await expect(generatePagefindIndex(ctx)).resolves.toBeUndefined();
  });

  it("does not surface pagefind failures to the build", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("not found"));

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await expect(generatePagefindIndex(ctx)).resolves.toBeUndefined();
  });

  it("continues silently when pagefind is unavailable", async () => {
    const originalError = new Error("spawn failed");
    vi.mocked(execa).mockRejectedValue(originalError);

    const ctx = createMockCtx({ outputDir: "/tmp/test/output" });
    await expect(generatePagefindIndex(ctx)).resolves.toBeUndefined();
  });
});
