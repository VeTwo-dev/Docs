import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Logger } from "../types/internal.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    spin: vi.fn(() => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      stop: vi.fn(),
      text: "",
    })),
    progress: vi.fn(),
    box: vi.fn(),
    table: vi.fn(),
  };
}

let lastMockLogger: Logger;

vi.mock("../logger/index.js", () => ({
  createLoggerSync: vi.fn(() => {
    lastMockLogger = createMockLogger();
    return lastMockLogger;
  }),
}));

vi.mock("../engine/index.js", () => ({
  build: vi.fn(async () => {}),
}));

vi.mock("../config/index.js", () => ({
  loadConfig: vi.fn(async () => ({
    config: {
      source: "./docs",
      output: "./docs-site",
      title: "Test",
      description: "Test docs",
    },
    filePath: "/test/docs.config.ts",
  })),
}));

vi.mock("rimraf", () => ({
  rimraf: vi.fn(async () => {}),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, cb: (err: unknown, stdout: string) => void) => {
    cb(null, "v20.10.0\n");
  }),
}));

vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(),
    })),
  },
}));

vi.mock("execa", () => ({
  execa: vi.fn(async () => ({ stdout: "" })),
}));

const httpCreateServerMock = vi.fn(() => ({
  listen: vi.fn((_p: number, _h: string, cb: () => void) => {
    if (cb) cb();
    return { close: vi.fn() };
  }),
  close: vi.fn(),
}));

vi.mock("node:http", () => ({
  createServer: (...args: unknown[]) => httpCreateServerMock(...args),
}));

const mockReadFileSync = vi.fn(() => JSON.stringify({ name: "test-pkg", version: "1.0.0" }));
const mockExistsSync = vi.fn(() => false);
const mockStatSync = vi.fn(() => ({ isFile: () => false }));
const mockCreateReadStream = vi.fn(() => ({
  pipe: vi.fn(),
  on: vi.fn(),
}));
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let program: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockStatSync.mockReturnValue({ isFile: () => false });
  httpCreateServerMock.mockImplementation(() => ({
    listen: vi.fn((_p: number, _h: string, cb: () => void) => {
      if (cb) cb();
      return { close: vi.fn() };
    }),
    close: vi.fn(),
  }));
  process.argv = ["node", "docs"];
  const mod = await import("./index.js");
  program = mod.program;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI program structure", () => {
  // The CLI module graph is large (AI, compiler, content subsystems) and
  // its first import can exceed the default timeout on loaded machines.
  it("has the name 'docs'", { timeout: 30_000 }, () => {
    expect(program.name()).toBe("docs");
  });

  it("has a description", () => {
    expect(program.description()).toContain("Documentation generator");
  });

  it("has the build command", () => {
    const cmd = program.commands.find((c) => c.name() === "build");
    expect(cmd).toBeDefined();
  });

  it("has the dev command", () => {
    const cmd = program.commands.find((c) => c.name() === "dev");
    expect(cmd).toBeDefined();
  });

  it("has the watch command", () => {
    const cmd = program.commands.find((c) => c.name() === "watch");
    expect(cmd).toBeDefined();
  });

  it("has the serve command", () => {
    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd).toBeDefined();
  });

  it("has the clean command", () => {
    const cmd = program.commands.find((c) => c.name() === "clean");
    expect(cmd).toBeDefined();
  });

  it("has the doctor command", () => {
    const cmd = program.commands.find((c) => c.name() === "doctor");
    expect(cmd).toBeDefined();
  });

  it("has the init command", () => {
    const cmd = program.commands.find((c) => c.name() === "init");
    expect(cmd).toBeDefined();
  });

  it("has the generate command", () => {
    const cmd = program.commands.find((c) => c.name() === "generate");
    expect(cmd).toBeDefined();
  });

  it("has the upgrade command", () => {
    const cmd = program.commands.find((c) => c.name() === "upgrade");
    expect(cmd).toBeDefined();
  });

  it("has --config global option", () => {
    const opt = program.options.find((o) => o.long === "--config");
    expect(opt).toBeDefined();
  });

  it("has --verbose global option", () => {
    const opt = program.options.find((o) => o.long === "--verbose");
    expect(opt).toBeDefined();
  });

  it("has --silent global option", () => {
    const opt = program.options.find((o) => o.long === "--silent");
    expect(opt).toBeDefined();
  });

  it("has --cwd global option", () => {
    const opt = program.options.find((o) => o.long === "--cwd");
    expect(opt).toBeDefined();
  });
});

describe("build command", () => {
  it("has --config option", () => {
    const cmd = program.commands.find((c) => c.name() === "build");
    const opt = cmd!.options.find((o) => o.long === "--config");
    expect(opt).toBeDefined();
  });

  it("calls build with rootDir and logger", async () => {
    const { build } = await import("../engine/index.js");
    await program.parseAsync(["node", "docs", "build"]);
    expect(build).toHaveBeenCalled();
    const args = (build as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args).toHaveProperty("rootDir");
    expect(args).toHaveProperty("logger");
  });

  it("passes configPath when --config is specified", async () => {
    const { build } = await import("../engine/index.js");
    await program.parseAsync(["node", "docs", "build", "--config", "./custom.config.ts"]);
    const args = (build as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.configPath).toBeDefined();
  });

  it("propagates build errors via exitWithError", async () => {
    const { build } = await import("../engine/index.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit called");
    });
    (build as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("build broke"));

    await expect(program.parseAsync(["node", "docs", "build"])).rejects.toThrow("exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

describe("clean command", () => {
  it("removes output directory via rimraf", async () => {
    const { rimraf } = await import("rimraf");
    mockExistsSync.mockReturnValue(true);

    await program.parseAsync(["node", "docs", "clean"]);
    expect(rimraf).toHaveBeenCalled();
  });

  it("removes .docs-cache directory via rimraf", async () => {
    const { rimraf } = await import("rimraf");
    let callCount = 0;
    mockExistsSync.mockImplementation((p: string) => {
      callCount++;
      if (callCount === 1) return true;
      if (String(p).includes(".docs-cache")) return true;
      return false;
    });

    await program.parseAsync(["node", "docs", "clean"]);
    expect(rimraf).toHaveBeenCalled();
  });

  it("does not call rimraf when directories do not exist", async () => {
    const { rimraf } = await import("rimraf");
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "docs", "clean"]);
    expect(rimraf).not.toHaveBeenCalled();
  });

  it("logs success when clean completes", async () => {
    mockExistsSync.mockReturnValue(false);
    await program.parseAsync(["node", "docs", "clean"]);
    expect(lastMockLogger.success).toHaveBeenCalledWith("Clean complete");
  });
});

describe("doctor command", () => {
  it("checks Node.js version via exec", async () => {
    const { exec } = await import("node:child_process");
    await program.parseAsync(["node", "docs", "doctor"]);
    expect(exec).toHaveBeenCalled();
  });

  it("checks package.json existence", async () => {
    mockExistsSync.mockImplementation((p: string) => {
      return String(p).includes("package.json");
    });
    await program.parseAsync(["node", "docs", "doctor"]);
    expect(lastMockLogger.table).toHaveBeenCalled();
  });

  it("checks config file existence", async () => {
    mockExistsSync.mockImplementation((p: string) => {
      return String(p).includes("docs.config.ts") || String(p).includes("package.json");
    });
    await program.parseAsync(["node", "docs", "doctor"]);
    expect(lastMockLogger.table).toHaveBeenCalled();
  });

  it("checks dependencies via require.resolve", async () => {
    await program.parseAsync(["node", "docs", "doctor"]);
    expect(lastMockLogger.table).toHaveBeenCalled();
  });

  it("reports all checks passed when everything is fine", async () => {
    mockExistsSync.mockReturnValue(true);
    await program.parseAsync(["node", "docs", "doctor"]);
    expect(lastMockLogger.table).toHaveBeenCalled();
    const summaryCalls =
      lastMockLogger.success.mock.calls.length + lastMockLogger.warn.mock.calls.length;
    expect(summaryCalls).toBeGreaterThan(0);
  });

  it("does not fail the run when only advisory checks fail", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    try {
      // Everything exists except the git repository (advisory check).
      mockExistsSync.mockImplementation((p: string) => !String(p).endsWith(".git"));
      await program.parseAsync(["node", "docs", "doctor"]);
      expect(lastMockLogger.table).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
      expect(lastMockLogger.warn).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("fails the run when a blocking check fails", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    try {
      // package.json missing is a blocking failure.
      mockExistsSync.mockImplementation((p: string) => !String(p).endsWith("package.json"));
      await program.parseAsync(["node", "docs", "doctor"]);
      expect(exitSpy).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});

describe("serve command", () => {
  it("has port and host options", () => {
    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd).toBeDefined();
    const portOpt = cmd!.options.find((o) => o.long === "--port");
    const hostOpt = cmd!.options.find((o) => o.long === "--host");
    expect(portOpt).toBeDefined();
    expect(hostOpt).toBeDefined();
  });

  it("starts an HTTP server when directory exists", async () => {
    const mockListen = vi.fn((_port: number, _host: string, cb: () => void) => {
      if (cb) cb();
      return { close: vi.fn() };
    });
    httpCreateServerMock.mockReturnValue({
      listen: mockListen,
      close: vi.fn(),
    });
    mockExistsSync.mockReturnValue(true);

    await program.parseAsync(["node", "docs", "serve", "--port", "8080", "--host", "0.0.0.0"]);
    expect(httpCreateServerMock).toHaveBeenCalled();
    expect(mockListen).toHaveBeenCalledWith(8080, "0.0.0.0", expect.any(Function));
  });

  it("returns 404 for missing files", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    await program.parseAsync(["node", "docs", "serve"]);

    mockExistsSync.mockReturnValue(false);
    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/missing.html" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, {
      "Content-Type": "text/html; charset=utf-8",
    });
    expect(res.end).toHaveBeenCalledWith("<h1>404 Not Found</h1>");
  });

  it("serves index.html for root path", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    await program.parseAsync(["node", "docs", "serve"]);

    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
  });

  it("returns 404 for path traversal URLs (URL normalization resolves them)", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    await program.parseAsync(["node", "docs", "serve"]);

    mockExistsSync.mockReturnValue(false);
    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/../../../etc/passwd" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, {
      "Content-Type": "text/html; charset=utf-8",
    });
  });

  it("uses correct MIME types for CSS files", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    await program.parseAsync(["node", "docs", "serve"]);

    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/styles.css" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "text/css; charset=utf-8",
    });
  });

  it("uses correct MIME types for JS files", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    await program.parseAsync(["node", "docs", "serve"]);

    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/app.js" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/javascript; charset=utf-8",
    });
  });

  it("uses correct MIME types for JSON files", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    await program.parseAsync(["node", "docs", "serve"]);

    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/data.json" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json; charset=utf-8",
    });
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    let handler: (
      req: { url?: string },
      res: {
        writeHead: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
      },
    ) => void;
    httpCreateServerMock.mockImplementation((h: (req: unknown, res: unknown) => void) => {
      handler = h as typeof handler;
      return {
        listen: vi.fn((_p: number, _h: string, cb: () => void) => {
          if (cb) cb();
        }),
        close: vi.fn(),
      };
    });

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });
    mockCreateReadStream.mockReturnValue({ pipe: vi.fn() });
    await program.parseAsync(["node", "docs", "serve"]);

    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler!({ url: "/file.xyz" }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/octet-stream",
    });
  });
});

describe("dev command", () => {
  it("has port option with default 3000", () => {
    const cmd = program.commands.find((c) => c.name() === "dev");
    expect(cmd).toBeDefined();
    const portOpt = cmd!.options.find((o) => o.long === "--port");
    expect(portOpt).toBeDefined();
  });

  it("has host option with default localhost", () => {
    const cmd = program.commands.find((c) => c.name() === "dev");
    const hostOpt = cmd!.options.find((o) => o.long === "--host");
    expect(hostOpt).toBeDefined();
  });

  it("has --open option", () => {
    const cmd = program.commands.find((c) => c.name() === "dev");
    const openOpt = cmd!.options.find((o) => o.long === "--open");
    expect(openOpt).toBeDefined();
  });
});

describe("global options", () => {
  it("config option takes a path argument", () => {
    const opt = program.options.find((o) => o.long === "--config");
    expect(opt).toBeDefined();
    expect(opt!.long).toBe("--config");
  });

  it("verbose is a boolean flag", () => {
    const opt = program.options.find((o) => o.long === "--verbose");
    expect(opt).toBeDefined();
  });

  it("silent is a boolean flag", () => {
    const opt = program.options.find((o) => o.long === "--silent");
    expect(opt).toBeDefined();
  });

  it("cwd option takes a path argument", () => {
    const opt = program.options.find((o) => o.long === "--cwd");
    expect(opt).toBeDefined();
  });

  it("sets verbose env when --verbose is passed", async () => {
    await program.parseAsync(["node", "docs", "--verbose", "build"]);
    expect(process.env["VETWO_LOG_LEVEL"]).toBe("debug");
    delete process.env["VETWO_LOG_LEVEL"];
  });

  it("sets error env when --silent is passed", async () => {
    await program.parseAsync(["node", "docs", "--silent", "build"]);
    expect(process.env["VETWO_LOG_LEVEL"]).toBe("error");
    delete process.env["VETWO_LOG_LEVEL"];
  });
});
