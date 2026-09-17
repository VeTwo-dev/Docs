/**
 * AI CLI Commands.
 *
 * Registers the `docs ai` command group for inspecting and configuring
 * the pluggable AI documentation provider system.
 */

import type { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverBuiltinProviders } from "../discovery.js";
import { createAIProviderRegistry } from "../registry.js";
import { hasCapability, supportedCapabilities } from "../capabilities.js";

interface LoggerLike {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  table(headers: string[], rows: string[][]): void;
}

/** Register the `docs ai` command group on a commander program. */
export function registerAICommands(
  program: Command,
  options: {
    logger: LoggerLike;
    findRootDir(): string;
  },
): void {
  const { logger, findRootDir } = options;

  const buildRegistry = () => {
    const registry = createAIProviderRegistry();
    const discovered = discoverBuiltinProviders();
    for (const entry of discovered) {
      registry.register(entry.factory);
    }
    return registry;
  };

  const ai = program.command("ai").description("Manage AI documentation providers");

  ai.command("list")
    .description("List available AI documentation providers")
    .action(() => {
      const registry = buildRegistry();
      const entries = registry.listEntries();

      if (entries.length === 0) {
        logger.info("No AI providers available.");
        return;
      }

      const def = registry.getDefault()?.metadata.id;
      logger.table(
        ["Provider", "Label", "Status"],
        entries.map((e) => [
          e.factory.metadata.id,
          e.factory.metadata.displayName,
          e.factory.metadata.id === def ? "default" : e.enabled ? "enabled" : "disabled",
        ]),
      );
    });

  ai.command("providers")
    .description("Alias for `docs ai list`")
    .action(() => {
      const registry = buildRegistry();
      const entries = registry.listEntries();
      if (entries.length === 0) {
        logger.info("No AI providers available.");
        return;
      }
      logger.table(
        ["Provider", "Models", "Aliases"],
        entries.map((e) => [
          e.factory.metadata.id,
          String(e.factory.metadata.models?.length ?? 0),
          e.factory.metadata.aliases?.join(", ") ?? "-",
        ]),
      );
    });

  ai.command("use <provider>")
    .description("Set the default AI provider")
    .action((providerId: string) => {
      const registry = buildRegistry();
      const factory = registry.resolve(providerId);
      if (factory === undefined) {
        logger.error(`Unknown provider: ${providerId}`);
        return;
      }
      try {
        // Persist selection under the project state root (never user source).
        const rootDir = findRootDir();
        const dir = join(rootDir, ".vetwo", "docs", "ai");
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "default-provider.json"),
          JSON.stringify({ provider: factory.metadata.id }, null, 2) + "\n",
          "utf-8",
        );
        logger.success(`Default AI provider set to "${factory.metadata.id}"`);
      } catch (error) {
        logger.error(
          `Failed to persist default provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

  ai.command("info [provider]")
    .description("Show details about an AI provider (or the default)")
    .action((providerId?: string) => {
      const registry = buildRegistry();
      const factory =
        providerId !== undefined ? registry.resolve(providerId) : registry.getDefault();
      if (factory === undefined) {
        logger.error(
          providerId !== undefined
            ? `Unknown provider: ${providerId}`
            : "No default provider configured.",
        );
        return;
      }
      const meta = factory.metadata;
      logger.info(`${meta.id}${meta.displayName !== undefined ? ` — ${meta.displayName}` : ""}`);
      if (meta.description !== undefined) logger.info(`  ${meta.description}`);
      logger.info(`  Models: ${meta.models.map((m) => m.id).join(", ") || "-"}`);
      logger.info(
        `  Auth: ${meta.auth.kind}${meta.auth.envVars?.length ? ` (${meta.auth.envVars.join(", ")})` : ""}`,
      );
      logger.info(
        `  Capabilities: ${supportedCapabilities(factory.create().capabilities).join(", ") || "none"}`,
      );
    });

  ai.command("capabilities [provider]")
    .description("List capability flags for an AI provider")
    .action((providerId?: string) => {
      const registry = buildRegistry();
      const factory =
        providerId !== undefined ? registry.resolve(providerId) : registry.getDefault();
      if (factory === undefined) {
        logger.error("No provider found.");
        return;
      }
      const caps = supportedCapabilities(factory.create().capabilities);
      if (caps.length === 0) {
        logger.info("No capabilities reported.");
        return;
      }
      logger.table(
        ["Capability", "Supported"],
        caps.map((c) => [c, hasCapability(factory.create().capabilities, c) ? "yes" : "no"]),
      );
    });

  ai.command("doctor")
    .description("Check AI provider configuration health")
    .action(() => {
      const registry = buildRegistry();
      const rows: string[][] = [];
      for (const entry of registry.listEntries()) {
        const meta = entry.factory.metadata;
        const envVars = meta.auth.envVars ?? [];
        const ok =
          meta.auth.kind === "none" || envVars.some((v) => (process.env[v] ?? "").length > 0);
        rows.push([
          meta.id,
          meta.auth.kind === "none" ? "no auth required" : envVars.join(", ") || "unknown",
          ok ? "\x1b[32m✓\x1b[0m ready" : "\x1b[31m✗\x1b[0m missing credentials",
        ]);
      }
      if (rows.length === 0) {
        logger.info("No AI providers installed.");
        return;
      }
      logger.table(["Provider", "Credential", "Status"], rows);
    });

  ai
    .command("review [proposal]")
    .description("Review pending AI content proposals (added/changed/removed with confidence)")
    .action((proposalPath?: string) => {
      const rootDir = findRootDir();
      const file =
        proposalPath !== undefined
          ? resolve(proposalPath)
          : join(rootDir, ".vetwo", "docs", "ai", "review", "pending.json");
      if (!existsSync(file)) {
        logger.info("No pending AI proposals.");
        logger.info(`\x1b[2mExpected at ${file}\x1b[0m`);
        return;
      }
      type Proposal = {
        slug?: string;
        action?: string;
        confidence?: number;
        evidence?: { value?: string }[];
      };
      let proposals: Proposal[];
      try {
        proposals = JSON.parse(readFileSync(file, "utf-8")) as Proposal[];
      } catch {
        logger.error("Proposal file unreadable");
        return;
      }
      if (!Array.isArray(proposals) || proposals.length === 0) {
        logger.success("No pending AI proposals.");
        return;
      }
      logger.table(
        ["Page", "Action", "Confidence", "Evidence"],
        proposals.map((p) => [
          p.slug ?? "-",
          p.action ?? "-",
          typeof p.confidence === "number" ? `${Math.round(p.confidence * 100)}%` : "-",
          (p.evidence ?? [])
            .map((e) => e.value)
            .slice(0, 2)
            .join(", ") || "-",
        ]),
      );
    });
}
