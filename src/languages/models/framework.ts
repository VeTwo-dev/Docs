import type { FrameworkAssociation } from "../contracts/framework.js";
import { deepFreeze } from "./freeze.js";

/** An immutable framework association model. */
export interface FrameworkAssociationModel {
  /** Unique framework id. */
  readonly id: string;
  /** Human-readable framework name. */
  readonly name: string;
  /** Dependency names that indicate this framework. */
  readonly dependencies: readonly string[];
  /** Default entry file basenames used by the framework. */
  readonly entryFiles: readonly string[];
  /** Language ids this framework requires. */
  readonly requires: readonly string[];
}

/** Builds an immutable framework model, normalising optional fields. */
export function createFrameworkAssociationModel(
  framework: FrameworkAssociation,
): FrameworkAssociationModel {
  return deepFreeze({
    id: framework.id,
    name: framework.name,
    dependencies: framework.dependencies !== undefined ? [...framework.dependencies] : [],
    entryFiles: framework.entryFiles !== undefined ? [...framework.entryFiles] : [],
    requires: framework.requires !== undefined ? [...framework.requires] : [],
  });
}
