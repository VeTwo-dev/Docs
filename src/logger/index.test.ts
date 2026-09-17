import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger, createLoggerSync, COLORS, formatTime } from "./index.js";

describe("logger/index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatTime", () => {
    it("formats milliseconds when under 1 second", () => {
      expect(formatTime(500)).toBe("500ms");
    });

    it("formats seconds when over 1 second", () => {
      expect(formatTime(1500)).toBe("1.50s");
    });

    it("formats 0ms", () => {
      expect(formatTime(0)).toBe("0ms");
    });
  });

  describe("COLORS", () => {
    it("contains ANSI color codes", () => {
      expect(COLORS.reset).toBe("\x1b[0m");
      expect(COLORS.red).toBe("\x1b[31m");
      expect(COLORS.green).toBe("\x1b[32m");
      expect(COLORS.bold).toBe("\x1b[1m");
    });
  });

  describe("createLoggerSync", () => {
    it("returns a logger with all required methods", () => {
      const logger = createLoggerSync();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.success).toBe("function");
      expect(typeof logger.spin).toBe("function");
      expect(typeof logger.progress).toBe("function");
      expect(typeof logger.box).toBe("function");
      expect(typeof logger.table).toBe("function");
    });

    it("info does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.info("test message")).not.toThrow();
    });

    it("warn does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.warn("test warning")).not.toThrow();
    });

    it("error does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.error("test error")).not.toThrow();
    });

    it("debug does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.debug("test debug")).not.toThrow();
    });

    it("success does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.success("test success")).not.toThrow();
    });

    it("spin returns a spinner object", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("loading...");
      expect(spinner).toBeDefined();
      expect(typeof spinner.succeed).toBe("function");
      expect(typeof spinner.fail).toBe("function");
      expect(typeof spinner.warn).toBe("function");
      expect(typeof spinner.info).toBe("function");
      expect(typeof spinner.stop).toBe("function");
    });

    it("spinner has text property", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("initial");
      expect(spinner.text).toBe("initial");
      spinner.stop();
    });

    it("spinner text can be set", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("initial");
      spinner.text = "updated";
      expect(spinner.text).toBe("updated");
      spinner.stop();
    });

    it("spinner succeed does not throw", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("working");
      expect(() => spinner.succeed("done!")).not.toThrow();
    });

    it("spinner fail does not throw", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("working");
      expect(() => spinner.fail("failed!")).not.toThrow();
    });

    it("spinner warn does not throw", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("working");
      expect(() => spinner.warn("warned!")).not.toThrow();
    });

    it("spinner info does not throw", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("working");
      expect(() => spinner.info("info!")).not.toThrow();
    });

    it("spinner stop does not throw", () => {
      const logger = createLoggerSync();
      const spinner = logger.spin("working");
      expect(() => spinner.stop()).not.toThrow();
    });

    it("progress does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.progress(5, 10, "loading")).not.toThrow();
    });

    it("progress with completed total does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.progress(10, 10, "done")).not.toThrow();
    });

    it("progress without label does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.progress(5, 10)).not.toThrow();
    });

    it("progress respects isTTY", () => {
      const original = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      const logger = createLoggerSync();
      expect(() => logger.progress(10, 10, "test")).not.toThrow();
      expect(() => logger.progress(5, 10, "test")).not.toThrow();
      Object.defineProperty(process.stdout, "isTTY", {
        value: original,
        writable: true,
        configurable: true,
      });
    });

    it("box does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.box("Title", "Content line 1\nContent line 2")).not.toThrow();
    });

    it("table does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.table(["Name", "Value"], [["foo", "bar"]])).not.toThrow();
    });

    it("table with empty rows does not throw", () => {
      const logger = createLoggerSync();
      expect(() => logger.table(["Name", "Value"], [])).not.toThrow();
    });
  });

  describe("createLogger (async)", () => {
    it("returns a logger with all required methods", async () => {
      const logger = await createLogger();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.success).toBe("function");
      expect(typeof logger.spin).toBe("function");
      expect(typeof logger.progress).toBe("function");
      expect(typeof logger.box).toBe("function");
      expect(typeof logger.table).toBe("function");
    });

    it("info does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.info("test message")).not.toThrow();
    });

    it("warn does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.warn("test warning")).not.toThrow();
    });

    it("error does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.error("test error")).not.toThrow();
    });

    it("debug does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.debug("test debug")).not.toThrow();
    });

    it("success does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.success("test success")).not.toThrow();
    });

    it("spin returns a spinner object", async () => {
      const logger = await createLogger();
      const spinner = logger.spin("loading...");
      expect(spinner).toBeDefined();
      expect(typeof spinner.succeed).toBe("function");
      expect(typeof spinner.fail).toBe("function");
      expect(typeof spinner.warn).toBe("function");
      expect(typeof spinner.info).toBe("function");
      expect(typeof spinner.stop).toBe("function");
      spinner.stop();
    });

    it("progress does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.progress(5, 10, "loading")).not.toThrow();
    });

    it("box does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.box("Title", "Content line 1\nContent line 2")).not.toThrow();
    });

    it("table does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.table(["Name", "Value"], [["foo", "bar"]])).not.toThrow();
    });

    it("progress does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.progress(5, 10, "loading")).not.toThrow();
    });

    it("progress with completed total does not throw", async () => {
      const logger = await createLogger();
      expect(() => logger.progress(10, 10, "done")).not.toThrow();
    });

    it("progress respects isTTY in async logger", async () => {
      const original = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      const logger = await createLogger();
      expect(() => logger.progress(10, 10, "test")).not.toThrow();
      expect(() => logger.progress(5, 10, "test")).not.toThrow();
      Object.defineProperty(process.stdout, "isTTY", {
        value: original,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("createLoggerSync log levels", () => {
    it("respects debug log level", () => {
      process.env["VETWO_LOG_LEVEL"] = "debug";
      const logger = createLoggerSync();
      expect(() => logger.debug("debug msg")).not.toThrow();
      expect(() => logger.info("info msg")).not.toThrow();
      expect(() => logger.warn("warn msg")).not.toThrow();
      expect(() => logger.error("error msg")).not.toThrow();
      delete process.env["VETWO_LOG_LEVEL"];
    });

    it("respects warn log level", () => {
      process.env["VETWO_LOG_LEVEL"] = "warn";
      const logger = createLoggerSync();
      expect(() => logger.debug("debug msg")).not.toThrow();
      expect(() => logger.info("info msg")).not.toThrow();
      expect(() => logger.warn("warn msg")).not.toThrow();
      expect(() => logger.error("error msg")).not.toThrow();
      delete process.env["VETWO_LOG_LEVEL"];
    });

    it("respects error log level", () => {
      process.env["VETWO_LOG_LEVEL"] = "error";
      const logger = createLoggerSync();
      expect(() => logger.debug("debug msg")).not.toThrow();
      expect(() => logger.info("info msg")).not.toThrow();
      expect(() => logger.warn("warn msg")).not.toThrow();
      expect(() => logger.error("error msg")).not.toThrow();
      delete process.env["VETWO_LOG_LEVEL"];
    });

    it("handles invalid log level gracefully", () => {
      process.env["VETWO_LOG_LEVEL"] = "invalid";
      const logger = createLoggerSync();
      expect(() => logger.info("info msg")).not.toThrow();
      delete process.env["VETWO_LOG_LEVEL"];
    });
  });
});
