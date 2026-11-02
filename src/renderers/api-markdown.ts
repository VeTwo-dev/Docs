/**
 * API Custom Blocks → Plain Markdown.
 *
 * Transforms custom IR API blocks (`ApiSignature`, `ParameterTable`,
 * `TypeDisplay`, `TypeParameterTable`, `HeritageDisplay`, `ApiMemberList`)
 * into portable Markdown structures (headings, code, tables, lists) so
 * plain-`.md` outputs and MDX hosts that forbid custom JSX both stay valid.
 * Shared by the Markdown renderer (`.md` mode) and the Fumadocs renderer.
 */

/**
 * Component names with a portable-Markdown degradation in
 * `renderCustomMarkdown`. Everything else is user MDX carried verbatim
 * by JSX-preserving outputs (Fumadocs, `.mdx`) and dropped by outputs
 * that cannot represent JSX (plain `.md`, static HTML).
 */
export const KNOWN_API_COMPONENTS: ReadonlySet<string> = new Set([
  "ApiSignature",
  "ParameterTable",
  "TypeDisplay",
  "TypeParameterTable",
  "HeritageDisplay",
  "ApiMemberList",
]);

/**
 * Escape characters that MDX table parsing may read as JSX/expressions.
 * Entities render identically inside code spans, so display is preserved.
 */
export function escCell(cell: string): string {
  return cell
    .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/g, "`$1`")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Transform a custom IR API block into plain Markdown structures.
 * Unknown components degrade to an empty string (caller filters blanks).
 */
export function renderCustomMarkdown(component: string, props: Record<string, unknown>): string {
  switch (component) {
    case "ApiSignature": {
      const name = String(props["name"] ?? "");
      const signature = String(props["signature"] ?? "");
      const deprecated = props["deprecated"];
      const lines = [`## ${name}`];
      if (signature.length > 0) lines.push("", "```ts", signature, "```");
      if (deprecated !== false && deprecated !== undefined) {
        const msg =
          typeof deprecated === "string" && deprecated.length > 0
            ? deprecated
            : "Use the replacement API instead.";
        lines.push("", `> **Deprecated.** ${msg}`);
      }
      return lines.join("\n");
    }
    case "ParameterTable": {
      const params = (props["parameters"] as Array<Record<string, unknown>> | undefined) ?? [];
      if (params.length === 0) return "";
      const rows = params.map((p) => {
        const name = `${p["rest"] === true ? "..." : ""}${String(p["name"] ?? "")}${p["required"] === false ? "?" : ""}`;
        const def =
          p["defaultValue"] !== undefined && String(p["defaultValue"]).length > 0
            ? ` (default: \`${String(p["defaultValue"])}\`)`
            : "";
        return `| \`${name}\` | \`${escCell(String(p["type"] ?? "unknown"))}\` | ${escCell(String(p["description"] ?? ""))}${def} |`;
      });
      return [
        "### Parameters",
        "",
        "| Name | Type | Description |",
        "| --- | --- | --- |",
        ...rows,
      ].join("\n");
    }
    case "TypeDisplay": {
      const type = String(props["type"] ?? "");
      if (type.length === 0) return "";
      const label = String(props["label"] ?? "Type");
      return `**${label}:** \`${type}\``;
    }
    case "TypeParameterTable": {
      const tps = (props["typeParameters"] as Array<Record<string, unknown>> | undefined) ?? [];
      if (tps.length === 0) return "";
      const rows = tps.map((t) => {
        const constraint =
          t["constraint"] !== undefined ? ` extends \`${String(t["constraint"])}\`` : "";
        const def = t["default"] !== undefined ? ` = \`${String(t["default"])}\`` : "";
        return `- \`${String(t["name"] ?? "")}\`${constraint}${def}`;
      });
      return ["### Type Parameters", "", ...rows].join("\n");
    }
    case "HeritageDisplay": {
      const parts: string[] = [];
      if (props["extends"] !== undefined) parts.push(`Extends \`${String(props["extends"])}\``);
      const impl = props["implements"];
      if (Array.isArray(impl) && impl.length > 0) {
        parts.push(`Implements ${impl.map((t) => `\`${String(t)}\``).join(", ")}`);
      }
      return parts.map((p) => `> ${p}`).join("\n");
    }
    case "ApiMemberList": {
      const members = (props["members"] as Array<Record<string, unknown>> | undefined) ?? [];
      if (members.length === 0) return "";
      const rows = members.map((m) => {
        const flags = [
          m["static"] === true ? "static " : "",
          m["readonly"] === true ? "readonly " : "",
        ].join("");
        const access = String(m["access"] ?? "public");
        const suffix = access !== "public" ? ` (${access})` : "";
        return `| \`${flags}${String(m["name"] ?? "")}\` | \`${escCell(String(m["kind"] ?? ""))}\`${suffix} | ${escCell(String(m["description"] ?? ""))} |`;
      });
      return [
        "### Members",
        "",
        "| Member | Kind | Description |",
        "| --- | --- | --- |",
        ...rows,
      ].join("\n");
    }
    default:
      return "";
  }
}
