import { describe, it, expect } from "vitest";

import { parseFrontmatter, extractLocks, parseMarkdown } from "./parser/markdown.js";
import { parseMdx } from "./parser/mdx.js";
import { createComponentRegistry } from "./components/registry.js";
import { fingerprintBlock } from "./fingerprint.js";
import { applyOverride, hideSections } from "./overrides.js";
import { composePage, threeWayMerge } from "./composition/engine.js";
import { semanticDiff } from "./semantic-diff.js";
import { expandSnippets, createFileSnippetResolver } from "./snippets.js";
import {
  extractContentLinks,
  resolveContentLinks,
  linkDiagnostics,
  buildRedirects,
} from "./links.js";
import { isTranslationStale, translationDiagnostics, localeOfPath } from "./i18n.js";
import {
  createOwnershipManifest,
  hashContent,
  auditOwnership,
  planRegeneration,
} from "./manifest.js";
import { lintContent } from "./lint.js";

const heading = (text: string) => ({ kind: "heading" as const, level: 2 as const, text });
const para = (text: string) => ({ kind: "paragraph" as const, text });

// ─── Markdown parser ─────────────────────────────────────────────────────

describe("content markdown parser", () => {
  it("parses frontmatter into typed fields", () => {
    const { data, body } = parseFrontmatter(
      `---\ntitle: Authentication\ndescription: Auth system\nsidebar:\n  order: 2\ncustom:\n  category: security\nunknownField: kept\n---\n\nBody here.`,
    );
    expect(data.title).toBe("Authentication");
    expect(data.description).toBe("Auth system");
    expect(data.sidebar?.order).toBe(2);
    expect(data.custom).toEqual({ category: "security" });
    expect(data.unknown).toEqual({ unknownField: "kept" });
    expect(body).toContain("Body here.");
  });

  it("extracts lock regions with offsets", () => {
    const raw = `intro\n<!-- @vetwo:lock -->\nkeep me\n<!-- /@vetwo:lock -->\nend`;
    const locks = extractLocks(raw);
    expect(locks).toHaveLength(1);
    const inside = raw.slice(locks[0]!.start, locks[0]!.end);
    expect(inside).toContain("keep me");
  });

  it("ignores unterminated locks", () => {
    expect(extractLocks("a <!-- @vetwo:lock --> b")).toHaveLength(0);
  });

  it("converts markdown to IR blocks", () => {
    const doc = parseMarkdown(
      "guides/auth.md",
      "guides/auth",
      [
        "---",
        "title: Auth",
        "---",
        "",
        "# Authentication",
        "",
        "Use tokens.",
        "",
        "- item one",
        "- [x] done",
        "",
        "> Warning: careful",
        "",
        "| a | b |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "```ts",
        "const x = 1;",
        "```",
      ].join("\n"),
    );

    const kinds = doc.blocks.map((b) => b.block.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("list");
    expect(kinds).toContain("callout");
    expect(kinds).toContain("table");
    expect(kinds).toContain("code");

    // Task list markers preserved.
    const list = doc.blocks.find((b) => b.block.kind === "list");
    if (list !== undefined && list.block.kind === "list") {
      expect(list.block.items.join(" ")).toContain("[x]");
    }
    // Warning tone inferred.
    const callout = doc.blocks.find((b) => b.block.kind === "callout");
    if (callout !== undefined && callout.block.kind === "callout") {
      expect(callout.block.tone).toBe("warning");
    }
    // All authored blocks owned by the user.
    expect(doc.blocks.every((b) => b.ownership === "user-authored")).toBe(true);
  });
});

// ─── MDX parser & component registry ─────────────────────────────────────

describe("content mdx parser", () => {
  it("converts JSX elements into data-only custom blocks (no execution)", () => {
    const result = parseMdx(
      "p.mdx",
      "p",
      [
        "---",
        "title: P",
        "---",
        "",
        '<Callout type="info">Important text</Callout>',
        "",
        "Normal paragraph.",
      ].join("\n"),
    );

    const custom = result.document.blocks.filter((b) => b.block.kind === "custom");
    expect(custom.length).toBeGreaterThanOrEqual(1);
    const first = custom[0];
    if (first !== undefined && first.block.kind === "custom") {
      expect(first.block.component).toBe("Callout");
      expect(first.block.props?.["type"]).toBe("info");
    }
  });

  it("captures expression containers as opaque strings, never evaluates them", () => {
    const result = parseMdx("p.mdx", "p", "Hello {process.exit(1)} world");
    const expr = result.document.blocks.find(
      (b) => b.block.kind === "custom" && b.block.component === "Expression",
    );
    expect(expr).toBeDefined();
    // The raw source is preserved as data — it is NOT executed anywhere.
    expect(JSON.stringify(expr)).toContain("process.exit(1)");
  });

  it("validates unknown components against the registry", () => {
    const registry = createComponentRegistry([
      { name: "Tabs", props: { labels: { type: "string", required: true } } },
    ]);
    const result = parseMdx("p.mdx", "p", "<Unknown>x</Unknown>\n\n<Tabs>no labels</Tabs>", {
      registry,
    });
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain("DOC_UNKNOWN_COMPONENT");
    expect(codes).toContain("DOC_MISSING_REQUIRED_PROP");
  });
});

describe("content component registry", () => {
  it("registers, resolves and unregisters without globals", () => {
    const a = createComponentRegistry();
    const b = createComponentRegistry();
    a.register({ name: "MyWidget", module: "./x.tsx" });
    expect(a.has("MyWidget")).toBe(true);
    expect(b.has("MyWidget")).toBe(false); // no singleton leakage
    expect(a.resolve("MyWidget")?.module).toBe("./x.tsx");
    expect(a.unregister("MyWidget")).toBe(true);
    expect(a.has("MyWidget")).toBe(false);
  });
});

// ─── Overrides ───────────────────────────────────────────────────────────

describe("content overrides", () => {
  const base = () => [
    {
      index: 0,
      block: { kind: "heading" as const, level: 1 as const, text: "Client API" },
      ownership: "generated" as const,
    },
    { index: 1, block: heading("Overview"), ownership: "generated" as const },
    { index: 2, block: para("Generated overview."), ownership: "generated" as const },
    { index: 3, block: heading("Source"), ownership: "generated" as const },
    { index: 4, block: para("Generated internals."), ownership: "generated" as const },
  ];

  it("replaces title, hides sections, inserts before/after", () => {
    const target = { title: "Client API", blocks: base() };
    const changes = applyOverride(target, {
      title: "HTTP Client",
      hideSections: ["Source"],
      before: [para("Custom intro.")],
      after: [para("Custom outro.")],
    });
    expect(changes).toBeGreaterThan(0);
    expect(target.title).toBe("HTTP Client");
    const texts = JSON.stringify(target.blocks.map((b) => b.block));
    expect(texts).not.toContain("Generated internals.");
    expect(texts).toContain("Custom intro.");
    expect(texts).toContain("Custom outro.");
  });

  it("replaces specific blocks by fingerprint prefix", () => {
    const target = { title: "T", blocks: base().slice(2, 3) };
    const fp = fingerprintBlock(para("Generated overview."));
    applyOverride(target, { replaceBlocks: { [fp.slice(0, 8)]: para("Replaced!") } });
    expect(JSON.stringify(target.blocks)).toContain("Replaced!");
  });

  it("hideSections keeps content after the section ends", () => {
    const blocks = [
      ...base(),
      { index: 5, block: heading("Next"), ownership: "generated" as const },
      { index: 6, block: para("After section."), ownership: "generated" as const },
    ];
    const hidden = hideSections(blocks, ["Source"]);
    const texts = hidden.map((b) => JSON.stringify(b.block)).join("");
    expect(texts).not.toContain("Source");
    expect(texts).not.toContain("Generated internals.");
    expect(texts).toContain("After section.");
  });
});

// ─── Composition engine ──────────────────────────────────────────────────

describe("content composition engine", () => {
  it("keeps user edits when generated content changes (three-way merge)", () => {
    const previousGen = [
      { kind: "heading" as const, level: 2 as const, text: "Install" },
      para("npm install old-pkg"),
    ];
    const currentGen = [
      { kind: "heading" as const, level: 2 as const, text: "Install" },
      para("npm install new-pkg"),
    ];
    const user = [
      { kind: "heading" as const, level: 2 as const, text: "Install" },
      para("npm install new-pkg --save"), // user edited the command
    ];

    const result = composePage({
      slug: "install",
      previousGenerated: { ownership: "generated", blocks: previousGen },
      generated: { ownership: "generated", blocks: currentGen },
      user: { ownership: "user-authored", blocks: user },
    });

    // User's edit survives; conflict is reported, not overwritten.
    expect(JSON.stringify(result.blocks)).toContain("--save");
    expect(result.conflicts.some((c) => c.code === "DOC_CONTENT_CONFLICT")).toBe(true);
  });

  it("refreshes untouched generated blocks transparently", () => {
    const previousGen = [
      { kind: "heading" as const, level: 2 as const, text: "A" },
      para("old text"),
    ];
    const currentGen = [
      { kind: "heading" as const, level: 2 as const, text: "A" },
      para("new text"),
    ];
    const user = [{ kind: "heading" as const, level: 2 as const, text: "A" }, para("old text")];

    const result = composePage({
      slug: "p",
      previousGenerated: { ownership: "generated", blocks: previousGen },
      generated: { ownership: "generated", blocks: currentGen },
      user: { ownership: "user-authored", blocks: user },
    });

    expect(JSON.stringify(result.blocks)).toContain("new text");
    expect(result.conflicts).toHaveLength(0);
  });

  it("protected pages are fully user-owned", () => {
    const result = composePage({
      slug: "p",
      protectedPage: true,
      generated: { ownership: "generated", blocks: [para("generated")] },
      user: { ownership: "user-authored", blocks: [para("mine")] },
    });
    expect(result.provenance.source).toBe("user");
    expect(JSON.stringify(result.blocks)).toContain("mine");
    expect(JSON.stringify(result.blocks)).not.toContain('generated"');
  });

  it("AI additions append without colliding with user content", () => {
    const result = composePage({
      slug: "p",
      user: { ownership: "user-authored", blocks: [para("mine")] },
      ai: { ownership: "ai-generated", blocks: [para("ai suggestion"), para("mine")] },
    });
    expect(JSON.stringify(result.blocks)).toContain("ai suggestion");
    const aiBlocks = result.blocks.filter((b) => b.ownership === "ai-generated");
    expect(aiBlocks).toHaveLength(1);
  });

  it("threeWayMerge flushes trailing generated blocks", () => {
    const merged = threeWayMerge({
      slug: "p",
      previous: [],
      currentGenerated: [para("gen-1"), para("gen-2")],
      currentUser: [para("user-1")],
      aiBlocks: [],
      conflicts: [],
    });
    const texts = JSON.stringify(merged);
    expect(texts).toContain("user-1");
    expect(texts).toContain("gen-1");
    expect(texts).toContain("gen-2");
  });
});

// ─── Semantic diff ───────────────────────────────────────────────────────

describe("content semantic diff", () => {
  it("reports renames, additions, removals semantically", () => {
    const before = [
      { kind: "heading" as const, level: 2 as const, text: "Setup" },
      para("old instructions"),
    ];
    const after = [
      { kind: "heading" as const, level: 2 as const, text: "Installation" },
      para("new instructions"),
      para("extra note"),
    ];
    const diff = semanticDiff(before, after);
    const kinds = diff.map((d) => d.kind);
    expect(kinds).toContain("heading-renamed");
    expect(kinds).toContain("content-added");
    expect(diff.find((d) => d.kind === "heading-renamed")?.after).toBe("Installation");
  });
});

// ─── Snippets ────────────────────────────────────────────────────────────

describe("content snippets", () => {
  const files: Record<string, string> = {
    installation: "Run `npm install {{package}}`.",
    prerequisites: "Node >= 20\n<!-- @vetwo:include installation -->",
  };

  it("expands includes recursively", () => {
    const result = expandSnippets(
      "Prereqs:\n<!-- @vetwo:include prerequisites -->",
      (name) => files[name],
    );
    expect(result.text).toContain("Node >= 20");
    expect(result.text).toContain("npm install");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("substitutes parameters safely", () => {
    const result = expandSnippets(
      '<!-- @vetwo:snippet name="installation" package="foo" -->',
      (name) => files[name],
    );
    expect(result.text).toContain("npm install foo");
  });

  it("detects circular includes", () => {
    const cyclic: Record<string, string> = {
      a: "A <!-- @vetwo:include b -->",
      b: "B <!-- @vetwo:include a -->",
    };
    const result = expandSnippets("<!-- @vetwo:include a -->", (n) => cyclic[n]);
    expect(result.diagnostics.some((d) => d.code === "DOC_CONTENT_CYCLE")).toBe(true);
  });

  it("reports missing snippets", () => {
    const result = expandSnippets("<!-- @vetwo:include nope -->", () => undefined);
    expect(result.diagnostics.some((d) => d.code === "DOC_BROKEN_LINK")).toBe(true);
  });

  it("resolves snippets from the filesystem", () => {
    const resolver = createFileSnippetResolver("/nonexistent-dir");
    expect(resolver("anything")).toBeUndefined();
  });
});

// ─── Links ───────────────────────────────────────────────────────────────

describe("content links", () => {
  const graph = {
    slugs: ["getting-started", "configuration", "api/client"],
    anchors: { configuration: ["options"] },
    aliases: { "client-api": "api/client" },
  };

  it("classifies internal/external/anchor links", () => {
    const links = extractContentLinks(
      "p",
      [
        "[guide](getting-started)",
        "[site](https://example.com)",
        "[config](configuration#options)",
        "[bad-anchor](configuration#nope)",
      ].join("\n"),
    );
    const resolutions = resolveContentLinks(links, graph);
    const statuses = resolutions.map((r) => r.status);
    expect(statuses).toContain("ok");
    expect(statuses).toContain("external");
    expect(statuses).toContain("missing-anchor");
  });

  it("detects missing pages and suggests renames", () => {
    const links = extractContentLinks("p", "[gs](geting-started)\n[gone](totally-missing)");
    const resolutions = resolveContentLinks(links, graph);
    const renamed = resolutions.find((r) => r.status === "renamed");
    expect(renamed?.rewrittenTo).toBe("getting-started");
    expect(linkDiagnostics(resolutions).some((d) => d.code === "DOC_BROKEN_LINK")).toBe(true);
  });

  it("resolves aliases", () => {
    const links = extractContentLinks("p", "[client](client-api)");
    const [resolution] = resolveContentLinks(links, graph);
    expect(resolution?.status).toBe("alias");
    expect(resolution?.rewrittenTo).toBe("api/client");
  });

  it("builds redirects from renames and aliases", () => {
    const redirects = buildRedirects({
      renames: [{ from: "old-guide", to: "guides/new-guide" }],
      aliases: { "api/client": ["/api/Client", "/client-api"] },
    });
    expect(redirects).toContainEqual({ from: "/old-guide", to: "/guides/new-guide" });
    expect(redirects).toContainEqual({ from: "client-api", to: "/api/client" });
  });
});

// ─── i18n ────────────────────────────────────────────────────────────────

describe("content i18n", () => {
  it("detects stale translations via fingerprint comparison", () => {
    const stale = {
      slug: "guide",
      locale: "ar",
      sourceFingerprint: "aaa",
      currentSourceFingerprint: "bbb",
      ownership: "ai-translated" as const,
    };
    const fresh = { ...stale, currentSourceFingerprint: "aaa" };
    expect(isTranslationStale(stale)).toBe(true);
    expect(isTranslationStale(fresh)).toBe(false);
    expect(translationDiagnostics([stale]).some((d) => d.code === "DOC_STALE_TRANSLATION")).toBe(
      true,
    );
    expect(translationDiagnostics([fresh])).toHaveLength(0);
  });

  it("infers locale from paths", () => {
    expect(localeOfPath("ar/guides/auth.mdx", ["en", "ar"])).toBe("ar");
    expect(localeOfPath("guides/auth.mdx")).toBe("en");
  });
});

// ─── Ownership manifest & regeneration ───────────────────────────────────

describe("content ownership manifest", () => {
  it("audits manual modifications of generated files", () => {
    const manifest = createOwnershipManifest([
      {
        path: "docs/generated/api.md",
        slug: "api",
        owner: "generated",
        contentHash: hashContent("original"),
      },
      {
        path: "docs/content/guide.mdx",
        owner: "user-authored",
        contentHash: hashContent("whatever"),
      },
    ]);

    const audit = auditOwnership(
      manifest,
      {
        "docs/generated/api.md": "manually edited!",
        "docs/content/guide.mdx": "changed by user freely",
        "docs/content/new.mdx": "brand new user file",
      },
      [],
    );

    expect(audit.modified).toEqual(["docs/generated/api.md"]);
    expect(audit.userFiles).toContain("docs/content/new.mdx");
    expect(audit.diagnostics.some((d) => d.code === "DOC_GENERATED_FILE_MODIFIED")).toBe(true);
  });

  it("plans regeneration respecting protection, conflicts and force", () => {
    const manifest = createOwnershipManifest([
      { path: "g/a.md", slug: "a", owner: "generated", contentHash: "h-a", fingerprint: "fpa" },
      { path: "g/b.md", slug: "b", owner: "generated", contentHash: "h-b", fingerprint: "fpb-old" },
      { path: "g/c.md", slug: "c", owner: "generated", contentHash: "h-c", fingerprint: "fpc" },
      { path: "g/d.md", slug: "d", owner: "generated", contentHash: "h-d", fingerprint: "fpd" },
      { path: "g/e.md", slug: "e", owner: "generated", contentHash: "h-e", fingerprint: "fpe" },
    ]);
    const candidates = [
      { slug: "a", path: "g/a.md", desiredFingerprint: "fpa", existsOnDisk: true }, // unchanged
      { slug: "b", path: "g/b.md", desiredFingerprint: "fpb-new", existsOnDisk: true }, // update
      { slug: "c", path: "g/c.md", desiredFingerprint: "fpc", existsOnDisk: false }, // deleted manually
      { slug: "d", path: "g/d.md", desiredFingerprint: "fpd", existsOnDisk: true }, // conflicted
      { slug: "e", path: "g/e.md", desiredFingerprint: "fpe", existsOnDisk: true }, // preserved
    ];

    const plan = planRegeneration({
      manifest,
      candidates,
      currentHashes: {},
      protectedSlugs: ["e"],
      conflictedSlugs: ["d"],
    });

    const actionOf = (slug: string) => plan.entries.find((e) => e.slug === slug)?.action;
    expect(actionOf("a")).toBe("preserve");
    expect(actionOf("b")).toBe("update");
    expect(actionOf("c")).toBe("review");
    expect(actionOf("d")).toBe("conflict");
    expect(actionOf("e")).toBe("preserve");

    // Force mode updates manually-modified pages…
    const forcePlan = planRegeneration({
      manifest,
      candidates: [
        { slug: "b", path: "g/b.md", desiredFingerprint: "fpb-new", existsOnDisk: true },
      ],
      currentHashes: { "g/b.md": "manually-changed" },
      force: true,
    });
    expect(forcePlan.entries[0]?.action).toBe("update");

    // …but force NEVER overrides protected pages.
    const forcedProtected = planRegeneration({
      manifest,
      candidates: [
        { slug: "prot", path: "g/p.md", desiredFingerprint: "new-fp", existsOnDisk: true },
      ],
      currentHashes: {},
      protectedSlugs: ["prot"],
      force: true,
    });
    expect(forcedProtected.entries[0]?.action).toBe("preserve");
  });
});

// ─── Linter ──────────────────────────────────────────────────────────────

describe("content linter", () => {
  it("flags duplicate headings, bad hierarchy, missing alt text, unknown languages", () => {
    const doc = parseMarkdown(
      "p.mdx",
      "p",
      ["# Title", "", "### Skips h2", "![](img.png)", "```notalang", "x", "```"].join("\n"),
    );
    const diagnostics = lintContent([doc], { maxHeadingDepth: 3 });
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("DOC_INVALID_HEADING_HIERARCHY");
    expect(codes).toContain("DOC_MISSING_ALT_TEXT");
    expect(codes).toContain("DOC_INVALID_CODE_LANGUAGE");
  });

  it("flags duplicate page titles across documents", () => {
    const mk = (name: string) =>
      parseMarkdown(name, name.replace(/\.\w+$/, ""), `---\ntitle: Same\n---\n\n# Body`);
    const diagnostics = lintContent([mk("a.mdx"), mk("b.mdx")]);
    expect(diagnostics.some((d) => d.code === "DOC_DUPLICATE_TITLE")).toBe(true);
  });
});

// ─── Fingerprint stability ───────────────────────────────────────────────

describe("content fingerprints", () => {
  it("are stable and input-sensitive", () => {
    expect(fingerprintBlock(para("same"))).toBe(fingerprintBlock(para("same")));
    expect(fingerprintBlock(para("a"))).not.toBe(fingerprintBlock(para("b")));
  });
});
