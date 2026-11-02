/**
 * Ecosystem integration contracts (Phase 23).
 *
 * Integrations are capability-driven: each one declares the capabilities it
 * provides, detects whether the project can benefit from it, and can plan
 * dependencies, generate documentation files and validate its own output.
 * All operations are deterministic and never mutate user files.
 */

import type { ProjectKnowledge } from "../intelligence/knowledge.js";

/** A dependency an integration may add to a generated project. */
export interface IntegrationDependency {
  /** npm package name. */
  readonly packageName: string;
  /** Version range/strategy (e.g. `^10.0.0`). */
  readonly versionStrategy: string;
  /** True when the dependency is optional. */
  readonly optional?: boolean;
}

/** The result of detecting whether an integration applies to a project. */
export interface IntegrationDetectionResult {
  /** Whether the integration is worth enabling. */
  readonly detected: boolean;
  /** Human-readable explanation of the decision. */
  readonly reason: string;
  /** Confidence in [0, 1]. */
  readonly confidence: number;
  /** Evidence supporting the decision. */
  readonly evidence: readonly string[];
}

/** A single file an integration generates. */
export interface IntegrationGeneratedFile {
  /** Path relative to the generated project root. */
  readonly path: string;
  /** File contents. */
  readonly contents: string;
}

/** The result of validating an integration's generated output. */
export interface IntegrationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Context handed to every integration operation. */
export interface IntegrationContext {
  /** Inferred project knowledge. */
  readonly projectKnowledge: ProjectKnowledge;
  /** Absolute project root directory. */
  readonly rootDir: string;
  /** Resolved documentation configuration. */
  readonly config: Record<string, unknown>;
}

/** A capability-driven ecosystem integration. */
export interface EcosystemIntegration {
  /** Unique integration id (e.g. `mermaid`). */
  readonly id: string;
  /** Primary npm package the integration targets. */
  readonly packageName: string;
  /** Human-readable description. */
  readonly description: string;
  /** Capabilities this integration provides. */
  readonly capabilities: readonly string[];
  /** Required dependencies. */
  readonly dependencies: readonly IntegrationDependency[];
  /** Optional dependencies. */
  readonly optionalDependencies?: readonly IntegrationDependency[];
  /** Detect whether the project can benefit from this integration. */
  detect(context: IntegrationContext): Promise<IntegrationDetectionResult>;
  /** Generate documentation files for the integration, when selected. */
  generate?(context: IntegrationContext): Promise<readonly IntegrationGeneratedFile[]>;
  /** Validate generated output, when applicable. */
  validate?(context: IntegrationContext): Promise<IntegrationValidationResult>;
}
