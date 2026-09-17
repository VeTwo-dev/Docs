export { classifyPath, isSystemOwned } from "./ownership.js";
export type { OwnershipContext, OwnershipResult } from "./ownership.js";
export { resolveConflict } from "./conflicts.js";
export type { ProposedOp, ResolvedAction } from "./conflicts.js";
export { OWNERSHIP_LABELS } from "../types/plan.js";
export type { Ownership, InitAction, RiskLevel } from "../types/plan.js";
