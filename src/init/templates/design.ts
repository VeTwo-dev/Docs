import { DESIGN_SOURCE_TEMPLATES } from "../../renderers/design/sources.js";
import type { ScaffoldFile } from "./next.js";

/**
 * The persistent design sources `docs init` materializes: `design/` is
 * user-owned after creation (writes are strictly create-missing-only;
 * existing files are skipped, never regenerated).
 */
export function buildDesignSources(): readonly ScaffoldFile[] {
  return DESIGN_SOURCE_TEMPLATES.map((t) => [t.path, t.contents] as ScaffoldFile);
}
