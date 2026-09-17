import matter from "gray-matter";
import {
  MANAGED_END,
  MANAGED_START,
  extractManagedSections,
  managedSection,
} from "../templates/skill.js";
import type { ManagedSection } from "../templates/skill.js";
import { SKILL_ID } from "../templates/skill.js";

/** Options for {@link mergeSkillContent}. */
export interface SkillMergeOptions {
  /** Replace existing managed section bodies (used on version upgrades). */
  readonly updateManaged?: boolean;
}

const SYSTEM_FIELDS = ["skill", "version", "generatedBy", "generatedAt", "project"] as const;

/**
 * Merges incoming generated skill content into an existing skill file.
 *
 * User-authored content outside the managed sections is preserved verbatim.
 * Managed sections are kept unless `updateManaged` is set (version upgrade).
 * Unknown frontmatter keys are preserved.
 */
export function mergeSkillContent(
  existing: string,
  incoming: string,
  options: SkillMergeOptions = {},
): string {
  const parsedExisting = matter(existing);
  const parsedIncoming = matter(incoming);

  const existingData = (parsedExisting.data ?? {}) as Record<string, unknown>;
  const incomingData = (parsedIncoming.data ?? {}) as Record<string, unknown>;
  const existingBody = parsedExisting.content;
  const incomingBody = parsedIncoming.content;

  const existingSections = extractManagedSections(existingBody);
  const incomingSections = extractManagedSections(incomingBody);

  const mergedData: Record<string, unknown> = { ...existingData };
  for (const field of SYSTEM_FIELDS) {
    if (field in incomingData) {
      mergedData[field] = incomingData[field];
    }
  }
  mergedData["skill"] = SKILL_ID;

  const mergedBody = rebuildBody({
    existingBody,
    existingSections,
    incomingSections,
    updateManaged: options.updateManaged === true,
  });

  return [serializeFrontmatter(mergedData), "", mergedBody].join("\n");
}

/**
 * Rebuilds the skill body from the existing file, preserving all
 * user-authored content. Managed sections present in the existing file keep
 * their bodies (unless `updateManaged`); managed sections missing from the
 * existing file are appended from the incoming template.
 */
function rebuildBody(options: {
  existingBody: string;
  existingSections: ReadonlyMap<ManagedSection, string>;
  incomingSections: ReadonlyMap<ManagedSection, string>;
  updateManaged: boolean;
}): string {
  const { existingBody, existingSections, incomingSections, updateManaged } = options;
  let body = existingBody.trimEnd();

  for (const section of [...incomingSections.keys()]) {
    const startMarker = `<!-- ${MANAGED_START} ${section} -->`;
    const endMarker = `<!-- ${MANAGED_END} ${section} -->`;
    const startIdx = body.indexOf(startMarker);
    const endIdx = body.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) continue;

    const content = updateManaged
      ? (incomingSections.get(section) ?? "")
      : (existingSections.get(section) ?? "");
    const inner = `\n\n${content.trim()}\n\n`;
    body = body.slice(0, startIdx + startMarker.length) + inner + body.slice(endIdx);
  }

  const missing = [...incomingSections.keys()].filter((section) => !existingSections.has(section));
  if (missing.length > 0) {
    if (body.length > 0) body += "\n\n";
    body += missing
      .map((section) => managedSection(section, incomingSections.get(section) ?? ""))
      .join("\n\n");
  }

  return body.trim() + "\n";
}

/** Serialise frontmatter data into a YAML-ish block, preserving extra keys. */
function serializeFrontmatter(data: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${scalar(value)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function scalar(value: unknown): string {
  if (typeof value === "string") {
    return /^[A-Za-z0-9 .,_-]*$/.test(value) ? value : JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
