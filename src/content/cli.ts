/**
 * Content CLI Commands.
 *
 * `docs content check|lint|diff|validate|conflicts` — surface the
 * authoring system's diagnostics without mutating user content.
 */

import type { Command } from "commander";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseMarkdown } from "./parser/markdown.js";
import { parseMdx } from "./parser/mdx.js";
import { createComponentRegistry } from "./components/registry.js";
import { createFileSnippetResolver, expandSnippets } from "./snippets.js";
import { lintContent } from "./lint.js";
import { semanticDiff } from "./semantic-diff.js";
import type { IRBlock } from "../documentation/compiler/ir.js";

interface LoggerLike {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  table(headers: string[], rows: string[][]): void;
}

const SEVERITY_ICON: Record<string, string> = {
  error: "\x1b[31m✕\x1b[0m",
  warning: "\x1b[33m⚠\x1b[0m",
  info: "\x1b[36mi\x1b[0m",
};

function listContentFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "generated" || entry === "node_modules" || entry.startsWith(".")) continue;
      results.push(...listContentFiles(full));
    } else if (/\.(md|mdx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

/** Load all authored documents from the content directory. */
export function loadAuthoredDocuments(contentDir: string) {
  const files = listContentFiles(contentDir);
  return files.map((file) => {
    const raw = readFileSync(file, "utf-8");
    const rel = file.slice(contentDir.length + 1).replace(/\\/g, "/");
    const slug = rel.replace(/\.(md|mdx)$/, "");
    if (file.endsWith(".mdx")) {
      return parseMdx(rel, slug, raw).document;
    }
    return parseMarkdown(rel, slug, raw);
  });
}

/** Register the `docs content` command group. */
export function registerContentCommands(
  program: Command,
  options: {
    logger: LoggerLike;
    findRootDir(): string;
  },
): void {
  const { logger, findRootDir } = options;

  const contentDirOf = (): string => join(findRootDir(), "docs", "content");

  const renderDiagnostics = (
    rows: readonly { severity: string; code: string; message: string; subject?: string }[],
  ): boolean => {
    if (rows.length === 0) return true;
    logger.table(
      ["Severity", "Code", "Message", "Subject"],
      rows.map((r) => [
        SEVERITY_ICON[r.severity] ?? r.severity,
        r.code,
        r.message,
        r.subject ?? "-",
      ]),
    );
    return false;
  };

  const content = program
    .command("content")
    .description("Inspect and validate authored documentation content");

  content
    .command("check")
    .description("Quick health check of authored content (parse errors only)")
    .action(() => {
      const dir = contentDirOf();
      const docs = loadAuthoredDocuments(dir);
      logger.info(`Loaded ${docs.length} document(s) from ${dir}`);
      logger.success("All documents parse cleanly");
    });

  content
    .command("lint")
    .description("Lint authored content quality")
    .option("--snippets <dir>", "Snippets directory", "docs/content/snippets")
    .action((options: { snippets: string }) => {
      const rootDir = findRootDir();
      const docs = loadAuthoredDocuments(join(rootDir, "docs", "content"));

      // Expand snippets before linting so includes are checked too.
      const resolveSnippet = createFileSnippetResolver(join(rootDir, options.snippets));
      let snippetDiagnostics: ReturnType<typeof expandSnippets>["diagnostics"] = [];
      for (const doc of docs) {
        const file = join(rootDir, "docs", "content", doc.path);
        if (!existsSync(file)) continue;
        const expansion = expandSnippets(readFileSync(file, "utf-8"), resolveSnippet);
        snippetDiagnostics = snippetDiagnostics.concat(expansion.diagnostics);
      }

      const diagnostics: ReturnType<typeof lintContent> = [
        ...lintContent(docs),
        ...snippetDiagnostics,
      ];
      const ok = renderDiagnostics(diagnostics);
      if (ok) logger.success("No content issues found");
    });

  content
    .command("validate")
    .description("Validate MDX components against the project component registry")
    .option("--components <json>", "Component metadata as JSON (name → module)", "{}")
    .action((options: { components: string }) => {
      const rootDir = findRootDir();
      let parsed: unknown;
      try {
        parsed = JSON.parse(options.components);
      } catch {
        logger.error("Invalid components JSON");
        return;
      }
      // Accept both an object map (name → metadata) and a plain array.
      const initial: { name: string }[] = Array.isArray(parsed)
        ? (parsed as { name: string }[])
        : Object.entries(parsed as Record<string, { name?: string }>).map(([name, meta]) => ({
            ...meta,
            name,
          }));
      const registry = createComponentRegistry(initial);

      const diagnostics = [];
      const files = listContentFiles(join(rootDir, "docs", "content"));
      for (const file of files) {
        if (!file.endsWith(".mdx")) continue;
        const result = parseMdx(file, file, readFileSync(file, "utf-8"), { registry });
        diagnostics.push(...result.diagnostics);
      }
      if (renderDiagnostics(diagnostics)) {
        logger.success(`All MDX components valid (${registry.list().length} registered)`);
      }
    });

  content
    .command("conflicts")
    .description("Show unresolved generated-vs-authored conflicts")
    .action(() => {
      // Conflicts are persisted by the composition engine during generation.
      const conflictsPath = join(findRootDir(), ".vetwo", "docs", "conflicts", "conflicts.json");
      if (!existsSync(conflictsPath)) {
        logger.success("No recorded conflicts");
        return;
      }
      try {
        const conflicts = JSON.parse(readFileSync(conflictsPath, "utf-8")) as {
          slug?: string;
          message?: string;
          severity?: string;
          code?: string;
        }[];
        if (conflicts.length === 0) {
          logger.success("No recorded conflicts");
          return;
        }
        renderDiagnostics(
          conflicts.map((c) => ({
            severity: c.severity ?? "warning",
            code: c.code ?? "DOC_CONTENT_CONFLICT",
            message: c.message ?? "",
            subject: c.slug,
          })),
        );
      } catch {
        logger.warn("Conflicts file unreadable — run docs generate to refresh");
      }
    });

  content
    .command("diff [slug]")
    .description("Semantic diff of a page against the last committed content snapshot")
    .action((slug: string | undefined) => {
      const rootDir = findRootDir();
      const snapshotPath = join(rootDir, ".vetwo", "docs", "snapshots", "content.json");
      if (!existsSync(snapshotPath)) {
        logger.info("No content snapshot yet — run `docs generate` first");
        return;
      }
      let snapshot: Record<
        string,
        { title: string; blocks: { block: { kind: string; text?: string } }[] }
      >;
      try {
        snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
      } catch {
        logger.error("Content snapshot unreadable");
        return;
      }

      const slugs = slug !== undefined ? [slug] : Object.keys(snapshot);
      let totalChanges = 0;
      for (const pageSlug of slugs) {
        const stored = snapshot[pageSlug];
        if (stored === undefined) {
          logger.warn(`No snapshot for "${pageSlug}"`);
          continue;
        }
        // Recompose the current version of this page.
        const docFile = ["mdx", "md"]
          .map((ext) => join(rootDir, "docs", "content", `${pageSlug}.${ext}`))
          .find((p) => existsSync(p));
        const currentBlocks: IRBlock[] = [];
        if (docFile !== undefined) {
          const contentDir = join(rootDir, "docs", "content");
          const doc = loadAuthoredDocuments(contentDir).find((d) => d.slug === pageSlug);
          if (doc !== undefined) currentBlocks.push(...doc.blocks.map((b) => b.block));
        }
        const changes = semanticDiff(
          stored.blocks.map((b) => b.block as IRBlock),
          currentBlocks,
        );
        if (changes.length === 0) continue;
        totalChanges += changes.length;
        logger.info(`${pageSlug}:`);
        for (const change of changes.slice(0, 12)) {
          const detail =
            change.after !== undefined
              ? `${change.subject} → ${change.after}`
              : change.subject;
          logger.info(`  ${change.kind}: ${detail}`);
        }
      }
      if (totalChanges === 0) {
        logger.success("No semantic changes since the last generation");
      }
    });
}
