import { describe, it, expect } from "vitest";
import type { PackageManager, ProjectType } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { createBuildContext, freezeContext } from "./context.js";

const defaultDetection = {
  projectType: "library" as ProjectType,
  packageManager: "npm" as PackageManager,
  workspaceInfo: undefined,
  packages: [],
};

describe("createBuildContext", () => {
  it("returns proper mutable context with defaults", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);

    expect(ctx.config).toBe(config);
    expect(ctx.rootDir).toBe("/project");
    expect(ctx.sourceDir).toBe(config.source);
    expect(ctx.outputDir).toBe(config.output);
    expect(ctx.projectType).toBe("library");
    expect(ctx.packageManager).toBe("npm");
  });

  it("initializes empty arrays", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);

    expect(ctx.sourceFiles).toEqual([]);
    expect(ctx.pages).toEqual([]);
    expect(ctx.navItems).toEqual([]);
    expect(ctx.sidebarGroups).toEqual([]);
    expect(ctx.apiDocs).toEqual([]);
    expect(ctx.sitemapEntries).toEqual([]);
    expect(ctx.rssEntries).toEqual([]);
    expect(ctx.errors).toEqual([]);
    expect(ctx.warnings).toEqual([]);
  });

  it("initializes searchIndex as undefined", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);

    expect(ctx.searchIndex).toBeUndefined();
  });

  it("has a startTime", () => {
    const before = Date.now();
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);
    const after = Date.now();

    expect(ctx.startTime).toBeGreaterThanOrEqual(before);
    expect(ctx.startTime).toBeLessThanOrEqual(after);
  });

  it("passes detection data through", () => {
    const config = defineDocs();
    const detection = {
      projectType: "monorepo" as ProjectType,
      packageManager: "pnpm" as PackageManager,
      workspaceInfo: {
        name: "root",
        version: "1.0.0",
        path: "/project",
        packageManager: "pnpm",
        workspaces: ["packages/*"],
      },
      packages: [
        {
          name: "pkg-a",
          version: "1.0.0",
          description: "A",
          path: "/project/packages/a",
          main: undefined,
          module: undefined,
          types: undefined,
          exports: undefined,
          files: [],
        },
      ],
    };

    const ctx = createBuildContext(config, "/project", detection);

    expect(ctx.projectType).toBe("monorepo");
    expect(ctx.packageManager).toBe("pnpm");
    expect(ctx.workspaceInfo).toBe(detection.workspaceInfo);
    expect(ctx.packages).toHaveLength(1);
  });
});

describe("freezeContext", () => {
  it("returns a frozen context", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);
    const frozen = freezeContext(ctx);

    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("freezes nested arrays", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);
    const frozen = freezeContext(ctx);

    expect(Object.isFrozen(frozen.pages)).toBe(true);
    expect(Object.isFrozen(frozen.navItems)).toBe(true);
    expect(Object.isFrozen(frozen.sidebarGroups)).toBe(true);
    expect(Object.isFrozen(frozen.errors)).toBe(true);
    expect(Object.isFrozen(frozen.warnings)).toBe(true);
  });

  it("preserves config reference", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);
    const frozen = freezeContext(ctx);

    expect(frozen.config).toBe(config);
  });

  it("preserves page data", () => {
    const config = defineDocs();
    const ctx = createBuildContext(config, "/project", defaultDetection);
    ctx.pages.push({
      id: "page-1",
      title: "Page One",
      description: "desc",
      slug: "/page-one",
      filePath: "/project/page.md",
      relativePath: "page.md",
      category: "guides",
      order: 0,
      content: "<p>content</p>",
      frontmatter: {},
      headings: [],
      links: [],
      wordCount: 5,
      readingTimeMinutes: 1,
      lastModified: new Date(),
    });

    const frozen = freezeContext(ctx);

    expect(frozen.pages).toHaveLength(1);
    expect(frozen.pages[0]!.title).toBe("Page One");
  });
});
