import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  asyncMap,
  asyncFilter,
  asyncForEach,
  asyncReduce,
  chunk,
  unique,
  groupBy,
  debounce,
  measureTime,
  measureTimeAsync,
} from "./async.js";

describe("utils/async", () => {
  describe("asyncMap", () => {
    it("maps items asynchronously", async () => {
      const result = await asyncMap([1, 2, 3], async (x) => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it("works with empty array", async () => {
      const result = await asyncMap([], async (x) => x);
      expect(result).toEqual([]);
    });

    it("preserves order despite varying async delays", async () => {
      const result = await asyncMap([3, 1, 2], async (x) => {
        await new Promise((r) => setTimeout(r, x * 10));
        return x;
      });
      expect(result).toEqual([3, 1, 2]);
    });
  });

  describe("asyncFilter", () => {
    it("filters items asynchronously", async () => {
      const result = await asyncFilter([1, 2, 3, 4], async (x) => x % 2 === 0);
      expect(result).toEqual([2, 4]);
    });

    it("returns empty when nothing matches", async () => {
      const result = await asyncFilter([1, 3, 5], async (x) => x % 2 === 0);
      expect(result).toEqual([]);
    });

    it("returns all when everything matches", async () => {
      const result = await asyncFilter([2, 4], async () => true);
      expect(result).toEqual([2, 4]);
    });
  });

  describe("asyncForEach", () => {
    it("calls function for each item", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      await asyncForEach([1, 2, 3], fn);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn.mock.calls[0]![0]).toBe(1);
      expect(fn.mock.calls[0]![1]).toBe(0);
      expect(fn.mock.calls[1]![0]).toBe(2);
      expect(fn.mock.calls[1]![1]).toBe(1);
      expect(fn.mock.calls[2]![0]).toBe(3);
      expect(fn.mock.calls[2]![1]).toBe(2);
    });

    it("works with empty array", async () => {
      const fn = vi.fn();
      await asyncForEach([], fn);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("asyncReduce", () => {
    it("reduces items sequentially", async () => {
      const result = await asyncReduce([1, 2, 3], async (acc, item) => acc + item, 0);
      expect(result).toBe(6);
    });

    it("returns initial value for empty array", async () => {
      const result = await asyncReduce([], async (acc, item) => acc + item, 42);
      expect(result).toBe(42);
    });
  });

  describe("chunk", () => {
    it("splits array into chunks", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("handles exact division", () => {
      expect(chunk([1, 2, 3, 4], 2)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("single chunk when size >= length", () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it("returns empty array for empty input", () => {
      expect(chunk([], 3)).toEqual([]);
    });
  });

  describe("unique", () => {
    it("removes duplicates", () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });

    it("returns same array if no duplicates", () => {
      expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("works with strings", () => {
      expect(unique(["a", "b", "a"])).toEqual(["a", "b"]);
    });

    it("returns empty for empty input", () => {
      expect(unique([])).toEqual([]);
    });
  });

  describe("groupBy", () => {
    it("groups items by key function", () => {
      const result = groupBy(
        [
          { type: "a", v: 1 },
          { type: "b", v: 2 },
          { type: "a", v: 3 },
        ],
        (item) => item.type,
      );
      expect(result).toEqual({
        a: [
          { type: "a", v: 1 },
          { type: "a", v: 3 },
        ],
        b: [{ type: "b", v: 2 }],
      });
    });

    it("returns empty object for empty array", () => {
      expect(groupBy([], (x: number) => x)).toEqual({});
    });

    it("works with numeric keys", () => {
      const result = groupBy([1, 2, 3, 4], (x) => x % 2);
      expect(result).toEqual({ "0": [2, 4], "1": [1, 3] });
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("delays function execution", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("resets timer on subsequent calls", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("measureTime", () => {
    it("returns result and duration", () => {
      const { result, duration } = measureTime(() => 42);
      expect(result).toBe(42);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("captures synchronous computation", () => {
      const { result } = measureTime(() => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
      });
      expect(result).toBe(499500);
    });
  });

  describe("measureTimeAsync", () => {
    it("returns result and duration for async function", async () => {
      const { result, duration } = await measureTimeAsync(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return "done";
      });
      expect(result).toBe("done");
      expect(duration).toBeGreaterThanOrEqual(5);
    });
  });
});
