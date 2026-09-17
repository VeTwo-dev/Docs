import { describe, it, expect } from "vitest";
import { buildOutputPlan, resolveDocumentationLink } from "./output-plan.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";

function makeIR(): DocumentationIR {
  const page = (slug: string, sectionId: string) => ({
    slug,
    title: slug,
    sectionId,
    blocks: [],
    examples: [],
    claims: [],
    references: [],
    fingerprint: slug,
    provenance: "compiler" as const,
  });
  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01",
    sections: [{ id: "s1", title: "S1", pageSlugs: ["introduction", "api/overview"] }],
    pages: [page("introduction", "s1"), page("api/overview", "s1")],
    navigation: {
      sidebar: [{ label: "S1", children: [{ label: "Intro", slug: "introduction" }, { label: "API", slug: "api/overview" }] }],
      breadcrumbs: {},
    },
  };
}

describe("buildOutputPlan", () => {
  it("plans canonical routes, md paths, static paths and segments", () => {
    const plan = buildOutputPlan(makeIR(), { workspaceRoot: "/tmp/w" });
    const api = plan.pagesBySlug.get("api/overview")!;
    expect(api.route).toBe("/docs/api/overview");
    expect(api.mdPath).toBe("api/overview.mdx");
    expect(api.staticPath).toBe("api/overview/index.html");
    expect([...api.segments]).toEqual(["api", "overview"]);
    expect(plan.homeSlug).toBe("introduction");
  });

  it("returns undefined homeSlug for empty IR", () => {
    const ir = makeIR();
    const empty: DocumentationIR = { ...ir, pages: [], navigation: { sidebar: [], breadcrumbs: {} } };
    expect(buildOutputPlan(empty, { workspaceRoot: "/tmp" }).homeSlug).toBeUndefined();
  });
});

describe("resolveDocumentationLink", () => {
  it("resolves next/markdown/static links", () => {
    const plan = buildOutputPlan(makeIR(), { workspaceRoot: "/tmp" });
    expect(resolveDocumentationLink(plan, "introduction", "api/overview", "next")).toBe("/docs/api/overview");
    expect(resolveDocumentationLink(plan, "introduction", "api/overview", "markdown")).toBe("api/overview.mdx");
    expect(resolveDocumentationLink(plan, "api/overview", "introduction", "markdown")).toBe("../introduction.mdx");
    expect(resolveDocumentationLink(plan, "introduction", "api/overview", "static")).toBe("../api/overview/");
    expect(resolveDocumentationLink(plan, "api/overview", "introduction", "static")).toBe("../../introduction/");
  });

  it("returns undefined for unknown slugs", () => {
    const plan = buildOutputPlan(makeIR(), { workspaceRoot: "/tmp" });
    expect(resolveDocumentationLink(plan, "introduction", "missing", "next")).toBeUndefined();
  });
});
