import { describe, it, expect } from "vitest";
import { createEventEmitter } from "./emitter.js";

describe("createEventEmitter", () => {
  it("delivers payloads to subscribed listeners", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    const received: number[] = [];
    emitter.on("ping", (payload) => received.push(payload.n));
    emitter.emit("ping", { n: 1 });
    emitter.emit("ping", { n: 2 });
    expect(received).toEqual([1, 2]);
  });

  it("returns an unsubscribe handle that stops delivery", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    const received: number[] = [];
    const off = emitter.on("ping", (payload) => received.push(payload.n));
    off();
    emitter.emit("ping", { n: 1 });
    expect(received).toEqual([]);
  });

  it("supports off() by reference", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    const listener = (_payload: { n: number }): void => undefined;
    const other = (): void => undefined;
    emitter.on("ping", listener);
    emitter.on("ping", other);
    expect(emitter.listenerCount("ping")).toBe(2);
    emitter.off("ping", listener);
    expect(emitter.listenerCount("ping")).toBe(1);
    emitter.emit("ping", { n: 1 });
  });

  it("clears all listeners", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    const received: number[] = [];
    emitter.on("ping", (payload) => received.push(payload.n));
    emitter.clear();
    emitter.emit("ping", { n: 1 });
    expect(received).toEqual([]);
  });

  it("reports listener counts", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    expect(emitter.listenerCount("ping")).toBe(0);
    const off = emitter.on("ping", () => undefined);
    expect(emitter.listenerCount("ping")).toBe(1);
    off();
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("never lets a throwing listener break the pipeline", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    const received: number[] = [];
    emitter.on("ping", () => {
      throw new Error("boom");
    });
    emitter.on("ping", (payload) => received.push(payload.n));
    expect(() => emitter.emit("ping", { n: 1 })).not.toThrow();
    expect(received).toEqual([1]);
  });

  it("does nothing when emitting to an event without listeners", () => {
    const emitter = createEventEmitter<{ ping: { n: number } }>();
    expect(() => emitter.emit("ping", { n: 1 })).not.toThrow();
  });
});
