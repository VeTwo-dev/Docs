import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols, detectPackages } from "../normalizers/normalizer.js";

/** Storybook story file conventions. */
const STORYBOOK_PATTERNS = [
  /\.stories\.(ts|tsx|js|jsx|mdx)$/,
  /\.story\.(ts|tsx|js|jsx)$/,
  /\.stories\.(mdx)$/,
];

/** A story export found in a Storybook file. */
interface Story {
  readonly name: string;
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly meta: string | undefined;
}

/**
 * Extracts component examples from Storybook files.
 *
 * Stories are demo-grade evidence: each `export const X: Story = ...`
 * binding represents a component variant. Story provenance is explicit so
 * the future engine never mistakes a story for production usage.
 */
export function createStorybookExampleExtractor(): ExampleExtractor {
  return {
    id: "storybook",
    name: "Storybook story extractor",
    provenanceKinds: ["storybook"],

    supports(path: string): boolean {
      return STORYBOOK_PATTERNS.some((pattern) => pattern.test(path));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const stories = extractStories(input.content);
      const results: RawExample[] = stories.map((story) => {
        const body = normalizeExampleBody(story.body);
        return {
          title: story.name,
          language: languageFor(input.path),
          content: body,
          provenance: provenance(
            "storybook",
            input.path,
            { startLine: story.startLine, endLine: story.endLine },
            story.name,
          ),
          description:
            story.meta !== undefined
              ? `Storybook story for component ${story.meta}`
              : "Storybook story",
          typeHint: "demo",
          framework: "storybook",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.9,
        };
      });
      return Object.freeze(results);
    },
  };
}

/** Finds Storybook story exports and their render bodies. */
export function extractStories(content: string): readonly Story[] {
  const results: Story[] = [];
  const component = componentName(content);

  // `export const X: Story = (args) => { ... }` or `export const X = {...}`
  const storyRe = /export\s+const\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = storyRe.exec(content)) !== null) {
    const name = match[1] ?? "story";
    const lineEnd = content.indexOf("\n", match.index);
    const restOfLine = content.slice(
      match.index + match[0].length,
      lineEnd === -1 ? undefined : lineEnd,
    );
    if (!/\s*=/.test(restOfLine)) continue;
    const eqIndex = content.indexOf("=", match.index + match[0].length);
    if (eqIndex === -1) continue;
    const openBrace = content.indexOf("{", eqIndex + 1);
    if (openBrace === -1) continue;
    const body = extractBalancedBlock(content, openBrace);
    if (body === undefined) continue;
    const startLine = content.slice(0, match.index).split("\n").length;
    const endLine = startLine + body.split("\n").length;
    results.push({ name, body, startLine, endLine, meta: component });
    storyRe.lastIndex = openBrace + 1;
  }

  // MDX stories: extract fenced blocks inside the default export template.
  const mdxRe = /```(?:jsx|tsx|js|ts)\n([\s\S]*?)```/g;
  let mdxMatch: RegExpExecArray | null;
  while ((mdxMatch = mdxRe.exec(content)) !== null) {
    const body = mdxMatch[1]!.trim();
    if (body.length === 0) continue;
    const startLine = content.slice(0, mdxMatch.index).split("\n").length;
    results.push({
      name: `MDX story ${results.length + 1}`,
      body,
      startLine,
      endLine: startLine + body.split("\n").length,
      meta: component,
    });
  }

  return Object.freeze(results);
}

/** Extract a `{ ... }` block honoring string/comment nesting. */
function extractBalancedBlock(content: string, openBraceIndex: number): string | undefined {
  let depth = 0;
  let inString: "'" | '"' | "`" | undefined;
  let escaped = false;
  let inLineComment = false;
  for (let i = openBraceIndex; i < content.length; i++) {
    const char = content[i]!;
    const next = content[i + 1];
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inString !== undefined) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === inString) {
        inString = undefined;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      escaped = false;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(openBraceIndex + 1, i);
    }
  }
  return undefined;
}

function componentName(content: string): string | undefined {
  const match = /component\s*:\s*(\w+)/.exec(content);
  return match?.[1];
}

function languageFor(path: string): string {
  return path.endsWith(".tsx") || path.endsWith(".ts")
    ? "tsx"
    : path.endsWith(".jsx")
      ? "jsx"
      : "js";
}
