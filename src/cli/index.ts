#!/usr/bin/env node

import { Command } from "commander";
import { createLoggerSync } from "../logger/index.js";
import { build } from "../engine/index.js";
import { loadConfig } from "../config/index.js";
import { resolveOutputDirectory } from "../config/resolve.js";
import { resolve, join, extname } from "node:path";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync, createReadStream } from "node:fs";
import { createServer } from "node:http";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { rimraf } from "rimraf";
import { detectProject, detectReadme, detectChangelog } from "../scanner/index.js";
import { BUILT_IN_THEMES } from "../themes/built-in.js";
import { registerAICommands } from "../ai/cli/commands.js";
import { registerCompilerCommands } from "../documentation/compiler/cli.js";
import { registerContentCommands } from "../content/cli.js";
import { registerIncrementalCommands } from "../incremental/cli.js";
import { EXIT_CODES, exitCodeForError, type ErrorCode } from "../errors/codes.js";

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

const globalOptions = {
  config: undefined as string | undefined,
  verbose: false,
  silent: false,
  quiet: false,
  ci: false,
  json: false,
  cwd: undefined as string | undefined,
  noColor: false,
};

/** Write JSON directly to stdout, bypassing the logger. */
function writeJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function getVersion(): string {
  try {
    const pkgPath = join(new URL(".", import.meta.url).pathname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "1.0.0";
  }
}

function findRootDir(): string {
  const base = globalOptions.cwd ?? process.cwd();
  let dir = base;
  while (dir !== "/") {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  return base;
}

function exitWithError(message: string, exitCode?: number): never {
  const logger = createLoggerSync();
  logger.error(message);
  process.exit(exitCode ?? EXIT_CODES.general);
}

/** Exit with a DocsError, using the appropriate exit code. */
function exitWithDocsError(code: ErrorCode, message: string): never {
  const logger = createLoggerSync();
  logger.error(message);
  process.exit(exitCodeForError(code));
}

function createLoggerFromGlobal() {
  if (globalOptions.verbose) {
    process.env["VETWO_LOG_LEVEL"] = "debug";
  }
  if (globalOptions.silent || globalOptions.quiet) {
    process.env["VETWO_LOG_LEVEL"] = "error";
  }
  // CI mode: suppress spinners and progress
  if (globalOptions.ci) {
    process.env["VETWO_LOG_LEVEL"] = "error";
    process.env["VETWO_CI"] = "1";
  }
  // NO_COLOR support (https://no-color.org/)
  if (globalOptions.noColor || process.env["NO_COLOR"] !== undefined) {
    process.env["FORCE_COLOR"] = "0";
    process.env["NO_COLOR"] = "1";
  }
  return createLoggerSync();
}

async function resolveConfig(rootDir: string) {
  const configPath = globalOptions.config ? resolve(rootDir, globalOptions.config) : undefined;
  if (configPath && existsSync(configPath)) {
    const dir = join(configPath, "..");
    return loadConfig(dir);
  }
  return loadConfig(rootDir);
}

const program = new Command();

program
  .name("docs")
  .description("@vetwo/docs - Documentation generator for JavaScript and TypeScript")
  .version(getVersion())
  .option("--config <path>", "Path to config file")
  .option("--verbose", "Enable verbose logging")
  .option("--silent", "Suppress all output")
  .option("--quiet", "Alias for --silent")
  .option("--ci", "CI mode: non-interactive, no spinners, no colors, deterministic output")
  .option("--json", "Output results as JSON (where applicable)")
  .option("--no-color", "Disable colored output")
  .option("--cwd <path>", "Working directory");

program.hook("preAction", (_thisCommand) => {
  const opts = program.opts();
  globalOptions.config = opts["config"] as string | undefined;
  globalOptions.verbose = opts["verbose"] as boolean;
  globalOptions.silent = opts["silent"] as boolean;
  globalOptions.quiet = opts["quiet"] as boolean;
  globalOptions.ci = opts["ci"] as boolean;
  globalOptions.json = opts["json"] as boolean;
  globalOptions.cwd = opts["cwd"] as string | undefined;
  globalOptions.noColor = (opts["color"] === false) as boolean;
});

program
  .command("init")
  .description("Initialize a documentation workspace (safe, idempotent)")
  .option("--dry-run", "Show what would happen without writing any files")
  .option("-y, --yes", "Apply only safe non-destructive actions without prompting")
  .option("--non-interactive", "Fail instead of prompting when conflicts require confirmation")
  .option("-o, --output <directory>", "Documentation output directory (e.g. wiki)")
  .action(async (options) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const { initializeDocumentationWorkspace } = await import("../init/index.js");
      await initializeDocumentationWorkspace({
        rootDir,
        dryRun: options.dryRun ?? false,
        yes: options.yes ?? false,
        nonInteractive: options.nonInteractive ?? false,
        outputDirectory: options.output,
        logger,
      });
    } catch (error) {
      exitWithError(`Init failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("dev")
  .description("Start development server with live reload")
  .option("-p, --port <port>", "Port number", "3000")
  .option("-H, --host <host>", "Host to bind to", "localhost")
  .option("--open", "Open browser automatically")
  .action(async (options) => {
    try {
      const rootDir = findRootDir();
      const { startDevServer } = await import("../dev-server/index.js");
      const { config } = await resolveConfig(rootDir);

      await startDevServer(rootDir, {
        port: parseInt(options.port, 10),
        host: options.host,
        open: options.open ?? false,
        sourceDir: config.source,
        extraWatch: [],
      });
    } catch (error) {
      exitWithError(`Dev server failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("watch")
  .description("Watch for file changes and rebuild")
  .action(async () => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      logger.info("Starting watch mode...");

      const chokidar = await import("chokidar");
      const { config } = await resolveConfig(rootDir);

      const watcher = chokidar.default.watch(config.source, {
        ignoreInitial: true,
        ignored: [/(^|[/\\])\../, /node_modules/],
      });

      let buildTimeout: ReturnType<typeof setTimeout> | null = null;

      const rebuild = async () => {
        if (buildTimeout) clearTimeout(buildTimeout);
        buildTimeout = setTimeout(async () => {
          logger.info("Rebuilding...");
          await build({ rootDir, logger });
        }, 300);
      };

      watcher.on("add", rebuild);
      watcher.on("change", rebuild);
      watcher.on("unlink", rebuild);

      await build({ rootDir, logger });
      try {
        const { summarizeContentHealth } = await import("../content/index.js");
        for (const line of summarizeContentHealth(rootDir).lines) {
          logger.info(line);
        }
      } catch {
        // content health is best-effort
      }
      logger.info("Watching for changes...");
    } catch (error) {
      exitWithError(`Watch mode failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("build")
  .description("Build documentation for production")
  .option("-c, --config <path>", "Path to config file")
  .option("--json", "Output build results as JSON")
  .action(async (options) => {
    const logger = createLoggerFromGlobal();
    const useJson = options.json ?? globalOptions.json;
    try {
      const rootDir = findRootDir();
      const configPath = options.config
        ? resolve(rootDir, options.config)
        : globalOptions.config
          ? resolve(rootDir, globalOptions.config)
          : undefined;
      const startTime = Date.now();
      await build({ rootDir, configPath, logger });
      const duration = Date.now() - startTime;
      if (useJson) {
        writeJson({ success: true, duration, timestamp: new Date().toISOString() });
      }
    } catch (error) {
      if (useJson) {
        writeJson({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        process.exit(EXIT_CODES.build);
      }
      exitWithError(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("generate")
  .description("Generate documentation (alias for build)")
  .option("--dry-run", "Plan safe content regeneration without writing files")
  .option("--force", "Update manually-edited generated pages (never protected ones)")
  .action(async (options) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();

      if (options.dryRun === true || options.force === true) {
        const { runContentRegeneration } = await import("../content/index.js");
        const { buildCompilerInput } = await import(
          "../documentation/compiler/index.js"
        );
        let components: Record<string, string> = {};
        try {
          const { config } = await resolveConfig(rootDir);
          components = { ...(config.components ?? {}) } as Record<string, string>;
        } catch {
          // config optional
        }
        const input = buildCompilerInput(rootDir);
        const result = runContentRegeneration({
          rootDir,
          input,
          components,
          dryRun: options.dryRun === true,
          force: options.force === true,
        });
        const s = result.plan.summary;
        logger.info(
          `Plan: ${s.create} create, ${s.update} update, ${s.delete} delete, ${s.preserve} preserve, ${s.conflict} conflict(s), ${s.review} review`,
        );
        if (result.conflicts.length > 0) {
          logger.warn(`${result.conflicts.length} conflict(s) — see \`docs content conflicts\``);
        }
        if (options.dryRun === true) {
          logger.success("Dry run complete — no files were modified");
          return;
        }
        logger.success(`Regenerated ${result.written.length} file(s)`);
      }

      await build({ rootDir, logger });
    } catch (error) {
      exitWithError(`Generate failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("clean")
  .description("Clean generated output and internal engine state")
  .option("--cache", "Only clean cached build artefacts")
  .option("--temporary", "Only clean temporary state")
  .option("--reports", "Only clean reports and diagnostics")
  .option("--state", "Clean safe regenerable internal state (indexes, graphs)")
  .option("--dry-run", "Show what would be removed without deleting anything")
  .action(async (options) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const { config } = await resolveConfig(rootDir);
      const outputDir = resolveOutputDirectory(config);

      if (existsSync(outputDir)) {
        if (options.dryRun) {
          logger.info(`Would remove ${outputDir}`);
        } else {
          await rimraf(outputDir);
          logger.success(`Removed ${outputDir}`);
        }
      }

      const { cleanTargets } = await import("../state/index.js");
      const hasFlag = Boolean(
        options.cache || options.temporary || options.reports || options.state,
      );
      const targets = cleanTargets(rootDir, {
        cache: hasFlag ? Boolean(options.cache) : true,
        temporary: hasFlag ? Boolean(options.temporary) : true,
        reports: hasFlag ? Boolean(options.reports) : true,
        state: Boolean(options.state),
        legacy: hasFlag ? Boolean(options.cache) : true,
      });

      for (const dir of targets) {
        if (existsSync(dir)) {
          if (options.dryRun) {
            logger.info(`Would remove ${dir}`);
          } else {
            await rimraf(dir);
            logger.success(`Removed ${dir}`);
          }
        }
      }

      logger.success("Clean complete");
    } catch (error) {
      exitWithError(`Clean failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("doctor")
  .description("Run diagnostics on your documentation setup")
  .option("--json", "Output results as JSON")
  .action(async (options: { json?: boolean }) => {
    const logger = createLoggerFromGlobal();
    const useJson = options.json ?? globalOptions.json;
    try {
      const rootDir = findRootDir();
      if (!useJson) logger.info("Running diagnostics...\n");

      const checks: Array<{ label: string; pass: boolean; detail: string; advisory?: boolean }> = [];

      let nodeVersion = process.version;
      try {
        const { stdout } = await execAsync("node --version");
        nodeVersion = stdout.trim();
      } catch {
        // fallback to process.version
      }
      const versionParts = nodeVersion.replace("v", "").split(".");
      const major = parseInt(versionParts[0] ?? "0", 10);
      const minor = parseInt(versionParts[1] ?? "0", 10);
      const nodeOk = major > 18 || (major === 18 && minor >= 18);
      checks.push({
        label: `Node.js ${nodeVersion}`,
        pass: nodeOk,
        detail: nodeOk ? "Supported" : "Minimum version is 18.18",
      });

      checks.push({
        label: "package.json",
        pass: existsSync(join(rootDir, "package.json")),
        detail: existsSync(join(rootDir, "package.json")) ? "Found" : "Not found",
      });

      let configFilePath: string | undefined;
      let configSource: string | undefined;
      try {
        const result = await resolveConfig(rootDir);
        configFilePath = result.filePath;
        configSource = result.config.source;
      } catch {
        // config not available
      }

      const configExists =
        existsSync(join(rootDir, "docs.config.ts")) ||
        existsSync(join(rootDir, "docs.config.js")) ||
        existsSync(join(rootDir, "docs.config.mjs"));
      checks.push({
        label: "Configuration file",
        pass: configExists,
        detail: configExists
          ? `Found: ${configFilePath ?? "docs.config.*"}`
          : "Not found - run `docs init`",
      });

      const sourceDir = configSource ?? "./docs";
      const sourceExists = existsSync(resolve(rootDir, sourceDir));
      checks.push({
        label: `Source directory (${sourceDir})`,
        pass: sourceExists,
        detail: sourceExists ? "Found" : "Not found",
      });

      const readme = detectReadme(rootDir);
      checks.push({
        label: "README",
        pass: readme !== undefined,
        detail: readme ? `Found: ${readme}` : "Not found",
      });

      const changelog = detectChangelog(rootDir);
      checks.push({
        label: "CHANGELOG",
        pass: changelog !== undefined,
        detail: changelog ? `Found: ${changelog}` : "Not found (optional)",
        advisory: true,
      });

      const detection = detectProject(rootDir);
      checks.push({
        label: "TypeScript",
        pass: detection.hasTypeScript,
        detail: detection.hasTypeScript ? "Detected" : "Not detected",
      });

      checks.push({
        label: "Git repository",
        pass: detection.hasGit,
        detail: detection.hasGit ? "Detected" : "Not detected (optional — limits changelog/migration features)",
        advisory: true,
      });

      const deps = ["commander", "chalk", "ora", "chokidar", "rimraf"];
      for (const dep of deps) {
        try {
          require.resolve(dep);
          checks.push({ label: dep, pass: true, detail: "Installed" });
        } catch {
          checks.push({ label: dep, pass: false, detail: "Not installed" });
        }
      }

      try {
        const { runStateDoctor } = await import("../state/index.js");
        const { NodeSafeFileSystem } = await import("../init/filesystem/index.js");
        const stateReport = runStateDoctor(new NodeSafeFileSystem(), rootDir);
        for (const check of stateReport.checks) {
          checks.push({
            label: check.label,
            pass: check.pass,
            detail: check.detail,
          });
        }
      } catch {
        checks.push({ label: "State root", pass: false, detail: "Could not inspect" });
      }

      // Documentation Knowledge Compiler checks (architecture quality).
      try {
        const { buildCompilerInput, compileDocumentation } =
          await import("../documentation/compiler/index.js");
        const input = buildCompilerInput(rootDir);
        const { architecture, ir, diagnostics } = compileDocumentation(input);
        checks.push({
          label: "Documentation architecture",
          pass: true,
          detail: `${architecture.project.archetypes.join(" + ")}, ${architecture.sections.length} sections, ${ir.pages.length} pages`,
        });
        const errors = diagnostics.filter((d) => d.severity === "error").length;
        const warnings = diagnostics.filter((d) => d.severity === "warning").length;
        checks.push({
          label: "Architecture quality",
          pass: errors === 0,
          detail:
            errors === 0 && warnings === 0
              ? "No issues"
              : `${errors} error(s), ${warnings} warning(s) — run \`docs analyze\``,
        });
      } catch {
        // Compiler analysis is best-effort; absence of package.json etc.
        // is already reported by earlier checks.
      }

      const passed = checks.filter((c) => c.pass).length;
      const failed = checks.filter((c) => !c.pass);
      const blockingFailed = failed.filter((c) => c.advisory !== true);
      const advisoryFailed = failed.filter((c) => c.advisory === true);

      if (useJson) {
        writeJson({
          checks: checks.map((c) => ({
            label: c.label,
            pass: c.pass,
            detail: c.detail,
            ...(c.advisory === true ? { advisory: true } : {}),
          })),
          summary: {
            passed,
            failed: failed.length,
            blockingFailed: blockingFailed.length,
            total: checks.length,
          },
        });
      } else {
        logger.table(
          ["Check", "Status", "Detail"],
          checks.map((c) => [
            c.label,
            c.pass ? "\x1b[32m✓\x1b[0m" : c.advisory === true ? "\x1b[33m⚠\x1b[0m" : "\x1b[31m✗\x1b[0m",
            c.detail,
          ]),
        );

        if (failed.length === 0) {
          logger.success(`All ${passed} checks passed`);
        } else {
          logger.warn(
            `${blockingFailed.length} blocking, ${advisoryFailed.length} advisory, ${passed} passed`,
          );
        }
      }

      if (blockingFailed.length > 0) {
        process.exit(EXIT_CODES.general);
      }
    } catch (error) {
      exitWithError(`Doctor failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("serve [dir]")
  .description("Serve the built documentation directory")
  .option("-p, --port <number>", "Port number", "3000")
  .option("--host <string>", "Host to bind to", "localhost")
  .action(async (dir: string | undefined, options: { port: string; host: string }) => {
    try {
      const rootDir = findRootDir();
      let serveDir: string;

      if (dir) {
        serveDir = resolve(rootDir, dir);
      } else {
        const { config } = await resolveConfig(rootDir);
        serveDir = resolve(rootDir, resolveOutputDirectory(config));
      }

      if (!existsSync(serveDir)) {
        exitWithError(`Directory does not exist: ${serveDir}. Run \`docs build\` first.`);
      }

      const logger = createLoggerFromGlobal();

      const port = parseInt(options.port, 10);
      const host = options.host;

      const MIME_TYPES: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".eot": "application/vnd.ms-fontobject",
      };

      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", `http://${host}:${port}`);
        let pathname = decodeURIComponent(url.pathname);

        if (pathname.endsWith("/")) {
          pathname = join(pathname, "index.html");
        }

        const filePath = join(serveDir, pathname);

        if (!filePath.startsWith(serveDir)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>404 Not Found</h1>");
          return;
        }

        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        createReadStream(filePath).pipe(res);
      });

      server.listen(port, host, () => {
        logger.success(`Serving ${serveDir}`);
        logger.info(`  Local: http://${host}:${port}`);
        logger.info("  Press Ctrl+C to stop");
      });
    } catch (error) {
      exitWithError(`Serve failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("upgrade")
  .description("Check for and install updates to @vetwo/docs and related packages")
  .option("--check", "Only check for updates, don't install")
  .action((options) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const pkgPath = join(rootDir, "package.json");
      if (!existsSync(pkgPath)) {
        exitWithError("No package.json found");
      }

      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const vetwoPackages = Object.keys(allDeps).filter(
        (dep) => dep.startsWith("@vetwo/") || dep === "vetwo",
      );

      if (vetwoPackages.length === 0) {
        logger.warn("No @vetwo/* packages found in dependencies");
        return;
      }

      logger.info(`Found ${vetwoPackages.length} @vetwo package(s): ${vetwoPackages.join(", ")}`);

      for (const pkgName of vetwoPackages) {
        try {
          const currentVersion = allDeps[pkgName] ?? "unknown";
          let latestVersion: string;
          try {
            const stdout = execSync(`npm view ${pkgName} version`, {
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
            latestVersion = stdout.trim();
          } catch {
            logger.warn(`  Could not fetch latest version for ${pkgName}`);
            continue;
          }

          const isOutdated =
            currentVersion !== latestVersion && !currentVersion.includes(latestVersion);
          if (isOutdated) {
            logger.info(`  ${pkgName}: ${currentVersion} -> ${latestVersion}`);
          } else {
            logger.info(`  ${pkgName}: ${currentVersion} (up to date)`);
          }
        } catch (err) {
          logger.warn(
            `  Error checking ${pkgName}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (options.check) {
        logger.info("Check complete (no changes made)");
        return;
      }

      const detection = detectProject(rootDir);
      const pm = detection.packageManager;
      const installCmdMap: Record<string, string> = {
        npm: "npm install",
        pnpm: "pnpm add",
        yarn: "yarn add",
        bun: "bun add",
      };
      const installBase = installCmdMap[pm] ?? "npm install";

      const packagesToUpdate = vetwoPackages.map((p) => `${p}@latest`).join(" ");
      const cmd = `${installBase} ${packagesToUpdate}`;

      logger.info(`Running: ${cmd}`);
      execSync(cmd, { cwd: rootDir, stdio: "inherit" });
      logger.success("Upgrade complete");
    } catch (error) {
      exitWithError(`Upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

const plugin = program.command("plugin").description("Manage documentation plugins");

plugin
  .command("list")
  .description("List installed plugins")
  .action(() => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const pkgPath = join(rootDir, "package.json");
      if (!existsSync(pkgPath)) {
        exitWithError("No package.json found");
      }

      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const pluginPattern = /^(?:@vetwo\/plugin-|vetwo-plugin-)/;
      const plugins = Object.keys(allDeps).filter((dep) => pluginPattern.test(dep));

      if (plugins.length === 0) {
        logger.info("No plugins installed.");
        return;
      }

      logger.table(
        ["Plugin", "Version"],
        plugins.map((name) => [name, allDeps[name] ?? "unknown"]),
      );
    } catch (error) {
      exitWithError(
        `Plugin list failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

plugin
  .command("add <name>")
  .description("Install a plugin")
  .option("--dev", "Install as devDependency (default: true)", true)
  .action((name: string, _options: { dev: boolean }) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const detection = detectProject(rootDir);
      const pm = detection.packageManager;

      const cmdMap: Record<string, string> = {
        npm: `npm install --save-dev ${name}`,
        pnpm: `pnpm add -D ${name}`,
        yarn: `yarn add --dev ${name}`,
        bun: `bun add -d ${name}`,
      };
      const cmd = cmdMap[pm] ?? `npm install --save-dev ${name}`;

      logger.info(`Installing ${name}...`);
      logger.info(`Running: ${cmd}`);
      execSync(cmd, { cwd: rootDir, stdio: "inherit" });
      logger.success(`Plugin ${name} installed successfully`);
    } catch (error) {
      exitWithError(
        `Plugin install failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

plugin
  .command("remove <name>")
  .description("Uninstall a plugin")
  .action((name: string) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const detection = detectProject(rootDir);
      const pm = detection.packageManager;

      const cmdMap: Record<string, string> = {
        npm: `npm uninstall ${name}`,
        pnpm: `pnpm remove ${name}`,
        yarn: `yarn remove ${name}`,
        bun: `bun remove ${name}`,
      };
      const cmd = cmdMap[pm] ?? `npm uninstall ${name}`;

      logger.info(`Uninstalling ${name}...`);
      logger.info(`Running: ${cmd}`);
      execSync(cmd, { cwd: rootDir, stdio: "inherit" });
      logger.success(`Plugin ${name} uninstalled successfully`);
    } catch (error) {
      exitWithError(
        `Plugin uninstall failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

const theme = program.command("theme").description("Manage documentation themes");
theme
  .command("list")
  .description("List available themes")
  .action(() => {
    const logger = createLoggerFromGlobal();
    try {
      logger.info("Built-in themes:");
      const builtInRows: string[][] = [];
      for (const [name, themeObj] of BUILT_IN_THEMES) {
        builtInRows.push([name, themeObj.label]);
      }
      if (builtInRows.length > 0) {
        logger.table(["Name", "Label"], builtInRows);
      }

      const rootDir = findRootDir();
      const pkgPath = join(rootDir, "package.json");
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const themePattern = /^(?:@vetwo\/theme-|vetwo-theme-)/;
        const installedThemes = Object.keys(allDeps).filter((dep) => themePattern.test(dep));

        if (installedThemes.length > 0) {
          logger.info("Installed theme packages:");
          logger.table(
            ["Package", "Version"],
            installedThemes.map((name) => [name, allDeps[name] ?? "unknown"]),
          );
        }
      }
    } catch (error) {
      exitWithError(`Theme list failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

theme
  .command("install <name>")
  .description("Install a theme package")
  .action((name: string) => {
    const logger = createLoggerFromGlobal();
    try {
      const rootDir = findRootDir();
      const detection = detectProject(rootDir);
      const pm = detection.packageManager;

      const cmdMap: Record<string, string> = {
        npm: `npm install --save-dev ${name}`,
        pnpm: `pnpm add -D ${name}`,
        yarn: `yarn add --dev ${name}`,
        bun: `bun add -d ${name}`,
      };
      const cmd = cmdMap[pm] ?? `npm install --save-dev ${name}`;

      logger.info(`Installing theme ${name}...`);
      logger.info(`Running: ${cmd}`);
      execSync(cmd, { cwd: rootDir, stdio: "inherit" });
      logger.success(`Theme ${name} installed successfully`);
    } catch (error) {
      exitWithError(
        `Theme install failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

registerAICommands(program, {
  logger: createLoggerSync(),
  findRootDir,
});

registerCompilerCommands(program, {
  logger: createLoggerSync(),
  findRootDir,
});

registerContentCommands(program, {
  logger: createLoggerSync(),
  findRootDir,
});

registerIncrementalCommands(program, {
  logger: createLoggerSync(),
  findRootDir,
});

export { program };

const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("/cli/index.js") || process.argv[1].endsWith("/cli/index.ts"));

if (isDirectExecution) {
  program.parse();
}
