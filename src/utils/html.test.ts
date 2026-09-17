import { describe, it, expect } from "vitest";
import { escapeHtml, escapeUrlAttr } from "./html.js";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes single quotes in attribute context", () => {
    expect(escapeHtml("onerror='alert(1)'")).toBe("onerror=&#39;alert(1)&#39;");
  });

  it("escapes multiple characters", () => {
    expect(escapeHtml('<p class="x">A & B</p>')).toBe(
      "&lt;p class=&quot;x&quot;&gt;A &amp; B&lt;/p&gt;",
    );
  });

  it("returns clean strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("escapeUrlAttr", () => {
  it("escapes double quotes", () => {
    expect(escapeUrlAttr('url"onerror="alert(1)')).toBe("url&quot;onerror=&quot;alert(1)");
  });

  it("escapes single quotes", () => {
    expect(escapeUrlAttr("url'onerror='alert(1)")).toBe("url&#39;onerror=&#39;alert(1)");
  });

  it("escapes angle brackets", () => {
    expect(escapeUrlAttr("javascript:<script>alert(1)</script>")).toBe(
      "javascript:&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("passes through normal URLs", () => {
    expect(escapeUrlAttr("https://example.com/logo.png")).toBe("https://example.com/logo.png");
  });

  it("passes through relative paths", () => {
    expect(escapeUrlAttr("/images/logo.png")).toBe("/images/logo.png");
  });
});
