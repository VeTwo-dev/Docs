/**
 * Documentation Component Registry.
 *
 * Registers custom documentation components (MDX) with metadata for
 * validation before rendering. Instance-based — no global singleton.
 */

/** Metadata a component may declare. */
export interface DocumentationComponentMetadata {
  /** Component name as used in MDX (e.g. `Callout`). */
  readonly name: string;
  readonly description?: string;
  /** Contexts where the component may appear (default: any). */
  readonly allowedContexts?: readonly string[];
  /** Rendering requirement. */
  readonly environment?: "server" | "client" | "either";
  /** JSON-schema-ish props declaration (simplified). */
  readonly props?: Readonly<
    Record<string, { readonly type: "string" | "number" | "boolean"; readonly required?: boolean }>
  >;
  /** Accessibility notes/requirements. */
  readonly accessibility?: string;
  /** Module specifier to resolve at render time. */
  readonly module?: string;
}

/** A registered component entry. */
export type RegisteredComponent = DocumentationComponentMetadata;

/**
 * A registry of documentation components.
 * Create instances via {@link createComponentRegistry}; never share
 * implicit global state.
 */
export interface DocumentationComponentRegistry {
  register(metadata: DocumentationComponentMetadata): void;
  unregister(name: string): boolean;
  resolve(name: string): RegisteredComponent | undefined;
  has(name: string): boolean;
  list(): readonly RegisteredComponent[];
}

export function createComponentRegistry(
  initial: readonly DocumentationComponentMetadata[] = [],
): DocumentationComponentRegistry {
  const components = new Map<string, RegisteredComponent>();

  const registry: DocumentationComponentRegistry = {
    register(metadata) {
      components.set(metadata.name, { ...metadata });
    },
    unregister(name) {
      return components.delete(name);
    },
    resolve(name) {
      return components.get(name);
    },
    has(name) {
      return components.has(name);
    },
    list() {
      return [...components.values()];
    },
  };

  for (const metadata of initial) registry.register(metadata);
  return registry;
}
