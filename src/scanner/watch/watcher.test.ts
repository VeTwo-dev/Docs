import { describe, expect, it } from "vitest";
import { ManualWatchSource, ScannerWatcher } from "./watcher.js";
import type { RawWatchEvent } from "../types/events.js";

describe("ManualWatchSource", () => {
  it("emits to listeners and supports unsubscribe", () => {
    const source = new ManualWatchSource();
    const received: RawWatchEvent[] = [];
    const off = source.on((event) => received.push(event));
    source.emit({ type: "add", path: "/root/a.ts" });
    off();
    source.emit({ type: "change", path: "/root/a.ts" });
    expect(received).toHaveLength(1);
  });

  it("stops emitting after close", () => {
    const source = new ManualWatchSource();
    const received: RawWatchEvent[] = [];
    source.on((event) => received.push(event));
    source.close();
    source.emit({ type: "add", path: "/root/a.ts" });
    expect(received).toHaveLength(0);
  });
});

describe("ScannerWatcher", () => {
  it("classifies and fans out raw events", () => {
    const source = new ManualWatchSource();
    const watcher = new ScannerWatcher({ source, rootDir: "/root" });
    const received: string[] = [];
    const off = watcher.on((event) => received.push(event.type));
    source.emit({ type: "add", path: "/root/src/a.ts" });
    source.emit({ type: "change", path: "/root/src/a.ts" });
    off();
    source.emit({ type: "unlink", path: "/root/src/a.ts" });
    expect(received).toEqual(["file-added", "file-modified"]);
    expect(watcher.isClosed).toBe(false);
  });

  it("closes cleanly and serialises", () => {
    const source = new ManualWatchSource();
    const watcher = new ScannerWatcher({ source, rootDir: "/root" });
    watcher.on(() => undefined);
    const json = watcher.toJSON();
    expect(json.rootDir).toBe("/root");
    expect(json.listeners).toBe(1);
    watcher.close();
    expect(watcher.isClosed).toBe(true);
    expect(watcher.toJSON().closed).toBe(true);
    // events after close are ignored
    source.emit({ type: "add", path: "/root/x.ts" });
  });

  it("ignores events when the source emits after closing", () => {
    const source = new ManualWatchSource();
    const watcher = new ScannerWatcher({ source, rootDir: "/root" });
    const received: string[] = [];
    watcher.on((event) => received.push(event.type));
    watcher.close();
    source.emit({ type: "add", path: "/root/x.ts" });
    expect(received).toEqual([]);
  });
});
