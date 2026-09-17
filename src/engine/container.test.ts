import { describe, it, expect } from "vitest";
import { ServiceContainer } from "./container.js";

describe("ServiceContainer", () => {
  it("lazily resolves registered services and caches the instance", () => {
    const container = new ServiceContainer();
    let calls = 0;

    container.register("counter", () => {
      calls++;
      return { value: calls };
    });

    const first = container.resolve<{ value: number }>("counter");
    const second = container.resolve<{ value: number }>("counter");

    expect(calls).toBe(1);
    expect(first).toBe(second);
    expect(first.value).toBe(1);
  });

  it("returns the same instance for registerValue", () => {
    const container = new ServiceContainer();
    const value = { hello: "world" };
    container.registerValue("value", value);

    expect(container.resolve("value")).toBe(value);
  });

  it("reports registered services via has and names", () => {
    const container = new ServiceContainer();
    container.register("a", () => 1);

    expect(container.has("a")).toBe(true);
    expect(container.has("missing")).toBe(false);
    expect(container.names()).toContain("a");
  });

  it("tracks materialised instances via isInitialized", () => {
    const container = new ServiceContainer();
    container.register("a", () => 1);

    expect(container.isInitialized("a")).toBe(false);
    container.resolve("a");
    expect(container.isInitialized("a")).toBe(true);
  });

  it("throws when registering a duplicate service", () => {
    const container = new ServiceContainer();
    container.register("dup", () => 1);

    expect(() => container.register("dup", () => 2)).toThrow(/already registered/);
    expect(() => container.registerValue("dup", 3)).toThrow(/already registered/);
  });

  it("throws when resolving an unregistered service", () => {
    const container = new ServiceContainer();

    expect(() => container.resolve("nope")).toThrow(/not registered/);
  });

  it("disposes instances with a dispose method and clears them", () => {
    const container = new ServiceContainer();
    const disposed: string[] = [];

    container.register("a", () => ({ dispose: () => disposed.push("a") }));
    container.register("b", () => ({ dispose: () => disposed.push("b") }));
    container.register("c", () => ({ plain: true }));

    container.resolve("a");
    container.resolve("b");
    container.resolve("c");
    container.dispose();

    expect(disposed.sort()).toEqual(["a", "b"]);
    expect(container.isInitialized("a")).toBe(false);
    expect(container.isInitialized("c")).toBe(false);
  });

  it("preserves registrations after dispose so it can be reused", () => {
    const container = new ServiceContainer();
    container.register("a", () => ({ n: 1 }));
    container.resolve("a");
    container.dispose();

    expect(container.has("a")).toBe(true);
    expect(container.resolve("a").n).toBe(1);
  });
});
