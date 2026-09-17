/**
 * A lightweight typed service container used by the docs engine.
 *
 * Services are registered with a factory and lazily instantiated on first
 * resolution. Resolved instances are cached for the lifetime of the container
 * (singleton semantics), giving subsystems a shared in-memory registry without
 * an external dependency injection library.
 */
export type ServiceFactory<T> = (container: ServiceContainer) => T;

const SERVICE_SYMBOL = Symbol.for("vetwo.docs.service-container.instance");

interface Registration<T> {
  readonly factory: ServiceFactory<T>;
}

/**
 * Typed service container with lazy singleton resolution.
 *
 * @example
 * ```ts
 * const container = new ServiceContainer();
 * container.register("logger", (c) => createLogger());
 * const logger = container.resolve<Logger>("logger");
 * ```
 */
export class ServiceContainer {
  private readonly registrations = new Map<string, Registration<unknown>>();
  private readonly instances = new Map<string, unknown>();

  /**
   * Registers a service factory under the given name.
   *
   * @param name - The unique service name/token.
   * @param factory - A factory invoked lazily on first resolution.
   * @returns The container for chaining.
   */
  register<T>(name: string, factory: ServiceFactory<T>): this {
    if (this.registrations.has(name)) {
      throw new Error(`Service "${name}" is already registered`);
    }
    this.registrations.set(name, { factory: factory as ServiceFactory<unknown> });
    return this;
  }

  /**
   * Registers an already-constructed value as a singleton service.
   *
   * @param name - The unique service name/token.
   * @param value - The pre-built service instance.
   * @returns The container for chaining.
   */
  registerValue<T>(name: string, value: T): this {
    if (this.registrations.has(name)) {
      throw new Error(`Service "${name}" is already registered`);
    }
    this.registrations.set(name, {
      factory: () => value as unknown,
    });
    this.instances.set(name, value as unknown);
    return this;
  }

  /**
   * Checks whether a service is registered.
   *
   * @param name - The service name/token.
   * @returns `true` if the service is registered.
   */
  has(name: string): boolean {
    return this.registrations.has(name);
  }

  /**
   * Resolves a service, lazily instantiating it on first access.
   *
   * @param name - The service name/token.
   * @returns The service instance (cached for subsequent calls).
   */
  resolve<T>(name: string): T {
    const cached = this.instances.get(name);
    if (cached !== undefined) {
      return cached as T;
    }
    const registration = this.registrations.get(name);
    if (!registration) {
      throw new Error(`Service "${name}" is not registered`);
    }
    const instance = registration.factory(this);
    this.instances.set(name, instance);
    return instance as T;
  }

  /**
   * Returns all currently registered service names.
   */
  names(): readonly string[] {
    return [...this.registrations.keys()];
  }

  /**
   * Whether a service instance has already been materialised.
   *
   * @param name - The service name/token.
   */
  isInitialized(name: string): boolean {
    return this.instances.has(name);
  }

  /**
   * Disposes all materialised service instances.
   *
   * Instances that expose a `dispose` method (or a `[SERVICE_SYMBOL]`
   * dispose function) are disposed before being cleared. Registrations are
   * preserved so the container can be reused for subsequent builds.
   */
  dispose(): void {
    for (const instance of this.instances.values()) {
      const candidate = instance as { dispose?: () => void | Promise<void> };
      if (candidate && typeof candidate.dispose === "function") {
        void candidate.dispose();
      }
    }
    this.instances.clear();
  }
}

export { SERVICE_SYMBOL };
