/**
 * Configuration discovery contract.
 *
 * Every language may declare the configuration files it recognises. The
 * scanner consumes this information automatically when matching project
 * configuration.
 */
export interface LanguageConfiguration {
  /** Configuration file basenames (e.g. `tsconfig.json`). */
  readonly files: readonly string[];
  /** Optional glob patterns covering additional configuration locations. */
  readonly patterns?: readonly string[];
  /** Optional JSON schema path describing the configuration format. */
  readonly schemaPath?: string;
  /** Optional human-readable description. */
  readonly description?: string;
}
