export {
  manifestPathFor,
  readManifest,
  writeManifest,
  createManifest,
  mergeManifest,
} from "./io.js";
export type { NewManifestContext } from "./io.js";
export {
  MANIFEST_DIR,
  MANIFEST_FILE,
  MANIFEST_SCHEMA_VERSION,
  SKILL_SCHEMA_VERSION,
} from "../types/manifest.js";
export type { WorkspaceManifest, ManifestFileEntry } from "../types/manifest.js";
