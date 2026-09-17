export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  setLevel(level: LogLevel): void;
}

export function createLogger(level: LogLevel = "info"): Logger {
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  let currentLevel = level;

  const log = (lvl: LogLevel, msg: string) => {
    if (levels[lvl] >= levels[currentLevel]) {
      console[lvl === "debug" ? "log" : lvl](`[${lvl.toUpperCase()}] ${msg}`);
    }
  };

  return {
    debug: (msg) => log("debug", msg),
    info: (msg) => log("info", msg),
    warn: (msg) => log("warn", msg),
    error: (msg) => log("error", msg),
    setLevel: (lvl) => {
      currentLevel = lvl;
    },
  };
}
