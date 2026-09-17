import type { Logger, Spinner } from "../types/internal.js";

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Creates a {@link Logger} instance that outputs to the terminal with colourised
 * messages via `chalk`, spinner support via `ora`, and progress bars.
 * Log level is read from the `VETWO_LOG_LEVEL` environment variable (defaults to `"info"`).
 *
 * @returns A fully configured Logger instance.
 *
 * @example
 * ```ts
 * const log = createLogger();
 * log.info("Building docs...");
 * log.success("Done!");
 * ```
 */
export async function createLogger(): Promise<Logger> {
  const chalkModule = await import("chalk");
  const chalk = chalkModule.default ?? chalkModule;
  const oraModule = await import("ora");
  const ora = oraModule.default ?? oraModule;

  const logLevel = process.env["VETWO_LOG_LEVEL"] ?? "info";
  const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[logLevel] ?? 1;

  function log(level: string, colorFn: (s: string) => string, message: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = chalk.dim(timestamp);
    const label = colorFn(level.toUpperCase());
    console.log(`${prefix} ${label} ${message}`);
  }

  const logger: Logger = {
    info: (message: string) => {
      if (currentLevel <= 1) log("info", chalk.blue, message);
    },
    warn: (message: string) => {
      if (currentLevel <= 2) log("warn", chalk.yellow, message);
    },
    error: (message: string) => {
      log("error", chalk.red, message);
    },
    debug: (message: string) => {
      if (currentLevel <= 0) log("debug", chalk.gray, message);
    },
    success: (message: string) => {
      if (currentLevel <= 1) log("success", chalk.green, message);
    },
    spin: (message: string): Spinner => {
      const spinner = ora({ text: message, color: "cyan" }).start();
      return {
        succeed: (msg?: string) => spinner.succeed(msg),
        fail: (msg?: string) => spinner.fail(msg),
        warn: (msg?: string) => spinner.warn(msg),
        info: (msg?: string) => spinner.info(msg),
        stop: () => spinner.stop(),
        get text(): string {
          return spinner.text;
        },
        set text(val: string) {
          spinner.text = val;
        },
      };
    },
    progress: (current: number, total: number, label?: string) => {
      if (!process.stdout.isTTY) return;
      const pct = Math.round((current / total) * 100);
      const filled = Math.round(pct / 5);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(20 - filled);
      const display = label ? `${label} ` : "";
      process.stdout.write(
        `\r${chalk.cyan("\u25B8")} ${display}${bar} ${chalk.bold(`${pct}%`)} (${current}/${total})`,
      );
      if (current === total) {
        process.stdout.write("\n");
      }
    },
    box: (title: string, content: string) => {
      const lines = content.split("\n");
      const maxLen = Math.max(title.length, ...lines.map((l) => l.length));
      const border = "\u2500".repeat(maxLen + 4);
      console.log(
        `\n${chalk.cyan(`\u250C${border}\u2510`)}\n` +
          `${chalk.cyan("\u2502")}${chalk.bold(` ${title.padEnd(maxLen + 2)}`)}${chalk.cyan("\u2502")}\n` +
          `${chalk.cyan(`\u251C${border}\u2524`)}\n` +
          lines
            .map(
              (line) => `${chalk.cyan("\u2502")} ${line.padEnd(maxLen + 2)}${chalk.cyan("\u2502")}`,
            )
            .join("\n") +
          `\n${chalk.cyan(`\u2514${border}\u2518`)}\n`,
      );
    },
    table: (headers: readonly string[], rows: readonly (readonly string[])[]) => {
      const widths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
      );
      const sep = widths.map((w) => "\u2500".repeat(w + 2)).join("\u253C");
      const headerRow = headers.map((h, i) => ` ${h.padEnd(widths[i]!)} `).join("\u2502");
      console.log(
        `\n${chalk.bold(headerRow)}\n` +
          sep +
          "\n" +
          rows
            .map((r) => r.map((c, i) => ` ${(c ?? "").padEnd(widths[i]!)} `).join("\u2502"))
            .join("\n") +
          "\n",
      );
    },
  };

  return logger;
}

/**
 * Synchronously creates a {@link Logger} instance for use in contexts where
 * async initialization is not possible (e.g., top-level CLI setup).
 * Falls back to raw ANSI codes if chalk/ora are unavailable.
 *
 * @returns A Logger instance.
 */
export function createLoggerSync(): Logger {
  const COLORS = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m",
  } as const;

  function log(level: string, color: string, message: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = `${COLORS.dim}${timestamp}${COLORS.reset}`;
    const label = `${color}${COLORS.bold}${level}${COLORS.reset}`;
    console.log(`${prefix} ${label} ${message}`);
  }

  const logLevel = process.env["VETWO_LOG_LEVEL"] ?? "info";
  const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[logLevel] ?? 1;

  return {
    info: (message: string) => {
      if (currentLevel <= 1) log("info", COLORS.blue, message);
    },
    warn: (message: string) => {
      if (currentLevel <= 2) log("warn", COLORS.yellow, message);
    },
    error: (message: string) => {
      log("error", COLORS.red, message);
    },
    debug: (message: string) => {
      if (currentLevel <= 0) log("debug", COLORS.gray, message);
    },
    success: (message: string) => {
      if (currentLevel <= 1) log("success", COLORS.green, message);
    },
    spin: (message: string): Spinner => ({
      succeed: (msg?: string) => log("success", COLORS.green, msg ?? message),
      fail: (msg?: string) => log("error", COLORS.red, msg ?? message),
      warn: (msg?: string) => log("warn", COLORS.yellow, msg ?? message),
      info: (msg?: string) => log("info", COLORS.blue, msg ?? message),
      stop: () => {},
      text: message,
    }),
    progress: (current: number, total: number, label?: string) => {
      if (!process.stdout.isTTY) return;
      const pct = Math.round((current / total) * 100);
      const filled = Math.round(pct / 5);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(20 - filled);
      const display = label ? `${label} ` : "";
      process.stdout.write(
        `\r${COLORS.cyan}\u25B8${COLORS.reset} ${display}${bar} ${COLORS.bold}${pct}%${COLORS.reset} (${current}/${total})`,
      );
      if (current === total) {
        process.stdout.write("\n");
      }
    },
    box: (title: string, content: string) => {
      const lines = content.split("\n");
      const maxLen = Math.max(title.length, ...lines.map((l) => l.length));
      const border = "\u2500".repeat(maxLen + 4);
      console.log(
        `\n${COLORS.cyan}\u250C${border}\u2510${COLORS.reset}\n` +
          `${COLORS.cyan}\u2502${COLORS.bold} ${title.padEnd(maxLen + 2)}${COLORS.cyan}\u2502${COLORS.reset}\n` +
          `${COLORS.cyan}\u251C${border}\u2524${COLORS.reset}\n` +
          lines
            .map(
              (line) =>
                `${COLORS.cyan}\u2502${COLORS.reset} ${line.padEnd(maxLen + 2)}${COLORS.cyan}\u2502${COLORS.reset}`,
            )
            .join("\n") +
          `\n${COLORS.cyan}\u2514${border}\u2518${COLORS.reset}\n`,
      );
    },
    table: (headers: readonly string[], rows: readonly (readonly string[])[]) => {
      const widths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
      );
      const sep = widths.map((w) => "\u2500".repeat(w + 2)).join("\u253C");
      const headerRow = headers.map((h, i) => ` ${h.padEnd(widths[i]!)} `).join("\u2502");
      console.log(
        `\n${COLORS.bold}${headerRow}${COLORS.reset}\n` +
          sep +
          "\n" +
          rows
            .map((r) => r.map((c, i) => ` ${(c ?? "").padEnd(widths[i]!)} `).join("\u2502"))
            .join("\n") +
          "\n",
      );
    },
  };
}

/**
 * ANSI colour codes used for terminal output.
 */
export const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

export { formatTime };
