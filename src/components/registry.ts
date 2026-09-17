import type { MdxComponent, MdxComponentInput } from "./types.js";
import { BUILT_IN_COMPONENTS } from "./built-in.js";

/**
 * Creates a mutable registry for managing MDX components.
 * Built-in components are registered by default.
 */
export function createComponentRegistry(): {
  readonly register: (component: MdxComponentInput) => void;
  readonly registerAll: (components: readonly MdxComponentInput[]) => void;
  readonly get: (name: string) => MdxComponent | undefined;
  readonly getAll: () => readonly MdxComponent[];
  readonly has: (name: string) => boolean;
} {
  const components = new Map<string, MdxComponent>();

  for (const comp of BUILT_IN_COMPONENTS) {
    components.set(comp.name, comp);
  }

  return {
    register(component) {
      const full: MdxComponent = {
        name: component.name,
        description: component.description ?? "",
        render: component.render,
      };
      components.set(component.name, full);
    },

    registerAll(inputs) {
      for (const input of inputs) {
        this.register(input);
      }
    },

    get(name) {
      return components.get(name);
    },

    getAll() {
      return [...components.values()];
    },

    has(name) {
      return components.has(name);
    },
  };
}

/**
 * Generates CSS styles for all built-in MDX components.
 *
 * @returns A CSS string for component styles.
 */
export function generateComponentCSS(): string {
  return `
.callout {
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  margin: 1.5rem 0;
  border-left: 4px solid;
  background: var(--light-surface);
}

.callout-title {
  margin-bottom: 0.5rem;
}

.callout-content p:last-child {
  margin-bottom: 0;
}

.callout-info { border-color: var(--light-callout-info); }
.callout-warning { border-color: var(--light-callout-warning); }
.callout-error { border-color: var(--light-callout-error); }
.callout-success { border-color: var(--light-callout-success); }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .callout { background: var(--dark-surface); }
}

:root[data-theme="dark"] .callout { background: var(--dark-surface); }

.code-block {
  position: relative;
  margin-bottom: 1.5rem;
}

.code-block-title {
  font-size: 0.8rem;
  font-family: var(--font-code);
  color: var(--light-text-muted);
  padding: 0.5rem 1rem;
  background: var(--light-surface);
  border: 1px solid var(--light-border);
  border-bottom: none;
  border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.code-block pre {
  margin-bottom: 0;
}

.code-copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--light-surface);
  border: 1px solid var(--light-border);
  border-radius: calc(var(--border-radius) / 2);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.code-block:hover .code-copy-btn {
  opacity: 1;
}

.tabs {
  margin: 1.5rem 0;
}

.tab-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--light-primary);
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--light-primary);
}

.tab-content {
  padding: 1rem 0;
}`;
}
