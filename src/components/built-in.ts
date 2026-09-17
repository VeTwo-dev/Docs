import type { MdxComponent } from "./types.js";
import { escapeHtml } from "../utils/html.js";

/** Info callout — informational note. */
export const Callout: MdxComponent = {
  name: "Callout",
  description: "A callout box for tips, warnings, or important information.",
  render: (props, children) => {
    const type = props["type"] ?? "info";
    const title = props["title"];
    const typeClass = `callout callout-${escapeHtml(type)}`;
    const titleHtml = title
      ? `<div class="callout-title"><strong>${escapeHtml(title)}</strong></div>`
      : "";
    return `<div class="${typeClass}">
      ${titleHtml}
      <div class="callout-content">${children}</div>
    </div>`;
  },
};

/** Code block with optional title and copy button. */
export const CodeBlock: MdxComponent = {
  name: "CodeBlock",
  description: "A code block with title and optional copy button.",
  render: (props, children) => {
    const lang = props["language"] ?? props["lang"] ?? "";
    const title = props["title"];
    const titleHtml = title ? `<div class="code-block-title">${escapeHtml(title)}</div>` : "";
    const langAttr = lang ? ` data-language="${escapeHtml(lang)}"` : "";
    return `<div class="code-block">
      ${titleHtml}
      <pre${langAttr}><code>${children}</code></pre>
      <button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">Copy</button>
    </div>`;
  },
};

/** Tabbed content container. */
export const Tabs: MdxComponent = {
  name: "Tabs",
  description: "A tabbed content container. Children should be Tab components.",
  render: (props, children) => {
    const id = props["id"] ?? `tabs-${Math.random().toString(36).slice(2, 8)}`;
    return `<div class="tabs" data-tabs-id="${escapeHtml(id)}">
      ${children}
    </div>`;
  },
};

/** Individual tab within a Tabs container. */
export const Tab: MdxComponent = {
  name: "Tab",
  description: "A single tab within a Tabs container.",
  render: (props, children) => {
    const label = props["label"] ?? "Tab";
    const id = props["tabsId"] ?? "";
    return `<div class="tab-panel" data-tab="${escapeHtml(label)}" data-tabs-id="${escapeHtml(id)}">
      <div class="tab-label">${escapeHtml(label)}</div>
      <div class="tab-content">${children}</div>
    </div>`;
  },
};

/** All built-in MDX components. */
export const BUILT_IN_COMPONENTS: readonly MdxComponent[] = [Callout, CodeBlock, Tabs, Tab];
