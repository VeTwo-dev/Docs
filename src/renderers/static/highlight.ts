/**
 * Dependency-free deterministic syntax highlighter for the static HTML
 * target.
 *
 * The static target is intentionally zero-JavaScript and has no Shiki
 * runtime, so fenced code is tokenized at build time into a small set of
 * span classes (`vetwo-tok-*`) that the shared design system colors via
 * tokens (`--vetwo-tok-*`). Both targets therefore present code on the
 * same ink panel token set; the Fumadocs target keeps its Shiki inline
 * colors untouched.
 *
 * Scope and safety:
 * - input is arbitrary content text; every emitted chunk is HTML-escaped,
 * - unsupported, markdown, or oversized inputs fall back to plain text,
 * - tokenization is purely sticky-regex scanning — deterministic per build.
 */

const MAX_HIGHLIGHT_LENGTH = 20_000;

const PLAIN_LANGUAGES = new Set(["md", "markdown", "mdx", "text", "txt"]);

export type TokenClass = "comment" | "string" | "number" | "interp" | "punct";

/** Ordered scan rules of one language family (scanner level). */
type Rule = readonly [TokenClass, RegExp];

const FAMILY_C_LIKE = 0;
const FAMILY_JSON = 1;
const FAMILY_CSS = 2;
const FAMILY_SHELL = 3;
const FAMILY_PYTHON = 4;
const FAMILY_YAML = 5;

const FAMILY_LANGUAGES: ReadonlyArray<ReadonlyArray<string>> = [
  [
    "js", "jsx", "javascript", "mjs", "cjs", "ts", "tsx", "typescript",
    "java", "kotlin", "swift", "go", "rust", "c", "cpp", "csharp", "cs",
    "php", "dart", "scala",
  ],
  ["json", "jsonc", "json5"],
  ["css", "scss", "sass", "less"],
  ["sh", "bash", "zsh", "shell", "console", "terminal"],
  ["py", "python"],
  ["yml", "yaml", "toml"],
];

const JS_KEYWORDS = [
  "abstract", "any", "as", "async", "await", "boolean", "break", "case",
  "catch", "class", "const", "continue", "debugger", "declare", "default",
  "delete", "do", "else", "enum", "export", "extends", "false", "finally",
  "for", "from", "function", "get", "if", "implements", "import", "in",
  "instanceof", "interface", "keyof", "let", "never", "new", "null",
  "number", "of", "private", "protected", "public", "readonly", "return",
  "satisfies", "set", "static", "string", "super", "switch", "this",
  "throw", "true", "try", "type", "typeof", "undefined", "unknown", "var",
  "void", "while", "yield",
];

const SHELL_KEYWORDS = [
  "cd", "do", "done", "echo", "elif", "else", "esac", "exit", "export",
  "false", "fi", "for", "function", "if", "in", "local", "return", "set",
  "source", "then", "true", "while",
];

const PYTHON_KEYWORDS = [
  "and", "as", "async", "await", "class", "def", "elif", "else", "except",
  "False", "finally", "for", "from", "global", "if", "import", "in",
  "lambda", "None", "not", "or", "pass", "print", "raise", "return",
  "True", "try", "while", "with", "yield",
];

const YAML_KEYWORDS = ["true", "false", "null", "yes", "no", "on", "off"];
const JSON_KEYWORDS = ["true", "false", "null"];

/** Sticky regexes. Never reuse without resetting `lastIndex`. */
const COMMENT_C = /\/\/[^\n]*|\/\*[\s\S]*?\*\//y;
const COMMENT_HASH = /#[^\n]*/y;
const COMMENT_CSS = /\/\*[\s\S]*?\*\//y;
const STRING_QUOTES = /"(?:\\.|[^\\\n"])*?"|'(?:\\.|[^\\\n'])*?'|`(?:\\.|[^\\`\n])*?`/y;
const STRING_DOUBLE = /"(?:\\.|[^\\\n"])*?"/y;
const NUMBER = /0[xX][0-9a-fA-F]+|0[bB][01]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[a-zA-Z%]*/y;
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/y;
/** Shell variable interpolation: $VAR / ${VAR}. */
const SHELL_INTERP = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/y;
const WORD = /[A-Za-z_$][A-Za-z0-9_$-]*/y;
const PUNCT = /[{}()[\];,.:=<>+\-*/%!&|?^~@]+/y;

function keywords(...words: ReadonlyArray<ReadonlyArray<string>>): ReadonlySet<string> {
  return new Set(words.flat());
}

interface LanguageProfile {
  readonly scanner: ReadonlyArray<Rule>;
  readonly keywords: ReadonlySet<string>;
}

function profileFor(family: number): LanguageProfile {
  switch (family) {
    case FAMILY_C_LIKE:
      return {
        scanner: [
          ["comment", COMMENT_C],
          ["string", STRING_QUOTES],
          ["number", NUMBER],
          ["punct", PUNCT],
        ],
        keywords: keywords(JS_KEYWORDS),
      };
    case FAMILY_JSON:
      return {
        scanner: [
          ["string", STRING_DOUBLE],
          ["number", NUMBER],
          ["punct", PUNCT],
        ],
        keywords: keywords(JSON_KEYWORDS),
      };
    case FAMILY_CSS:
      return {
        scanner: [
          ["comment", COMMENT_CSS],
          ["string", STRING_QUOTES],
          ["number", HEX_COLOR],
          ["number", NUMBER],
          ["punct", PUNCT],
        ],
        keywords: keywords(),
      };
    case FAMILY_SHELL:
      return {
        scanner: [
          ["comment", COMMENT_HASH],
          ["string", STRING_QUOTES],
          ["interp", SHELL_INTERP],
          ["number", NUMBER],
        ],
        keywords: keywords(SHELL_KEYWORDS),
      };
    case FAMILY_PYTHON:
      return {
        scanner: [
          ["comment", COMMENT_HASH],
          ["string", STRING_QUOTES],
          ["number", NUMBER],
          ["punct", PUNCT],
        ],
        keywords: keywords(PYTHON_KEYWORDS),
      };
    default: // YAML / TOML
      return {
        scanner: [
          ["comment", COMMENT_HASH],
          ["string", STRING_QUOTES],
          ["number", NUMBER],
          ["punct", PUNCT],
        ],
        keywords: keywords(YAML_KEYWORDS),
      };
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SCANNER_CLASS: Readonly<Record<TokenClass, string>> = {
  comment: "vetwo-tok-comment",
  string: "vetwo-tok-string",
  number: "vetwo-tok-number",
  interp: "vetwo-tok-fn",
  punct: "vetwo-tok-punct",
};

function span(tokenClass: string, text: string): string {
  return `<span class="${tokenClass}">${escapeHtml(text)}</span>`;
}

/**
 * Highlight one fenced code block into HTML (escaped, classed spans).
 * Unsupported, markdown, or oversized inputs return plain escaped text.
 */
export function highlightCode(code: string, language: string): string {
  if (code.length === 0) return "";
  const normalized = language.trim().toLowerCase();
  if (PLAIN_LANGUAGES.has(normalized) || code.length > MAX_HIGHLIGHT_LENGTH) {
    return escapeHtml(code);
  }
  const family = FAMILY_LANGUAGES.findIndex((langs) => langs.includes(normalized));
  if (family < 0) return escapeHtml(code);
  const profile = profileFor(family);

  try {
    let html = "";
    let plain = "";
    let i = 0;
    const flushPlain = (): void => {
      if (plain !== "") {
        html += escapeHtml(plain);
        plain = "";
      }
    };

    scan: while (i < code.length) {
      // 1. Scanner-level tokens (comments, strings, numbers, interp, punct).
      for (const [tokenClass, regex] of profile.scanner) {
        regex.lastIndex = i;
        const match = regex.exec(code);
        if (match !== null && match[0].length > 0) {
          flushPlain();
          html += span(SCANNER_CLASS[tokenClass], match[0]);
          i += match[0].length;
          continue scan;
        }
      }
      // 2. Identifiers: keywords, function calls, or unstyled words.
      WORD.lastIndex = i;
      const word = WORD.exec(code);
      if (word !== null && word[0].length > 0) {
        flushPlain();
        const text = word[0];
        if (profile.keywords.has(text)) {
          html += span("vetwo-tok-keyword", text);
        } else if (code[i + text.length] === "(") {
          html += span("vetwo-tok-fn", text);
        } else {
          html += escapeHtml(text);
        }
        i += text.length;
        continue;
      }
      // 3. Everything else accumulates as plain text.
      plain += code[i]!;
      i++;
    }
    flushPlain();
    return html;
  } catch {
    // Deterministic safety net: highlighting must never break a page build.
    return escapeHtml(code);
  }
}
