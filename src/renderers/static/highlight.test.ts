/**
 * Unit tests for the static target's build-time syntax highlighter.
 *
 * Contract:
 * - every emitted chunk is HTML-escaped (content text is data, never markup),
 * - supported languages produce the shared `vetwo-tok-*` span classes,
 * - unsupported, markdown, and oversized inputs fall back to plain text,
 * - tokenization is deterministic (same input → same output, always).
 */

import { describe, expect, it } from "vitest";
import { escapeHtml, highlightCode } from "./highlight.js";

describe("escapeHtml", () => {
  it("escapes markup-significant characters", () => {
    expect(escapeHtml(`<script>alert("x&y")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;",
    );
  });
});

describe("highlightCode — supported languages", () => {
  it("classifies keywords, strings, comments and numbers in TypeScript", () => {
    const html = highlightCode(
      'import { Page } from "./page";\nconst retry = 3; // attempts\n',
      "ts",
    );
    expect(html).toContain(`<span class="vetwo-tok-keyword">import</span>`);
    expect(html).toContain(`<span class="vetwo-tok-keyword">const</span>`);
    expect(html).toContain(`<span class="vetwo-tok-fn">Page</span>`);
    expect(html).toContain(`<span class="vetwo-tok-number">3</span>`);
    expect(html).toContain(`<span class="vetwo-tok-comment">// attempts</span>`);
    expect(html).toContain(`<span class="vetwo-tok-string">&quot;./page&quot;</span>`);
  });

  it("stays escaped inside styled spans", () => {
    const html = highlightCode('const evil = "</pre>";', "ts");
    expect(html).not.toContain("</pre>");
    expect(html).toContain("&lt;/pre&gt;");
  });

  it("tokenizes shell comments, strings and $variables", () => {
    const html = highlightCode('# install\npnpm build --prod "$DIR"', "bash");
    expect(html).toContain(`<span class="vetwo-tok-comment"># install</span>`);
    expect(html).toContain(`<span class="vetwo-tok-fn">$DIR</span>`);
    expect(html).toContain(`<span class="vetwo-tok-string">&quot;$DIR&quot;</span>`);
  });

  it("tokenizes JSON primitives", () => {
    const html = highlightCode('{ "n": 2, "ok": true, "x": null }', "json");
    expect(html).toContain(`<span class="vetwo-tok-keyword">true</span>`);
    expect(html).toContain(`<span class="vetwo-tok-keyword">null</span>`);
    expect(html).toContain(`<span class="vetwo-tok-number">2</span>`);
  });

  it("tokenizes CSS comments, strings, hex colors and numbers", () => {
    const html = highlightCode('/* theme */\nbrowser.a[href="x"] { color: #34d399; width: 10px; }', "css");
    expect(html).toContain(`<span class="vetwo-tok-comment">/* theme */</span>`);
    expect(html).toContain(`<span class="vetwo-tok-string">&quot;x&quot;</span>`);
    expect(html).toContain(`<span class="vetwo-tok-number">#34d399</span>`);
    expect(html).toContain(`<span class="vetwo-tok-number">10px</span>`);
  });

  it("tokenizes Python comments, keywords and strings", () => {
    const html = highlightCode('# setup\ndef run(config):\n    return "ok"', "python");
    expect(html).toContain(`<span class="vetwo-tok-comment"># setup</span>`);
    expect(html).toContain(`<span class="vetwo-tok-keyword">def</span>`);
    expect(html).toContain(`<span class="vetwo-tok-keyword">return</span>`);
    expect(html).toContain(`<span class="vetwo-tok-string">&quot;ok&quot;</span>`);
  });
});

describe("highlightCode — graceful fallbacks", () => {
  it("returns plain escaped text for unsupported languages", () => {
    const html = highlightCode("SELECT * FROM walls;", "sql");
    expect(html).toBe("SELECT * FROM walls;");
  });

  it("returns plain escaped text for markdown", () => {
    const html = highlightCode("# Heading\n*em*", "markdown");
    expect(html).toBe("# Heading\n*em*");
  });

  it("returns escaped text without spans for empty language", () => {
    const html = highlightCode("const a = 1;", "");
    expect(html).toBe("const a = 1;");
  });

  it("degrades oversized input to plain escaped text (no pathological runs)", () => {
    const big = "const x = 1;\n".repeat(2200);
    const html = highlightCode(big, "ts");
    expect(html).toBe(escapeHtml(big));
  });
});

describe("highlightCode — determinism", () => {
  it("is byte-identical across repeated invocations", () => {
    const sample =
      'import { DocsLayout } from "fumadocs-ui/layouts/docs";\nfunction App(): React.ReactNode {\n  return null; }\n';
    expect(highlightCode(sample, "ts")).toBe(highlightCode(sample, "ts"));
  });

  it("never emits an unescaped '<' that opens a tag other than span", () => {
    const html = highlightCode(
      'const a = "<img src=x onerror=alert(1)>"; // <script>\n',
      "ts",
    );
    const tags = html.match(/<(?!\/?span\b)/g) ?? [];
    expect(tags).toEqual([]);
  });
});
