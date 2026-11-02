/**
 * Ecosystem Integration CLI Commands
 *
 * Provides `docs integrations` subcommands: list, plan, validate
 */

import type { Command } from "commander";
import { createIntegrationRegistry } from "./registry.js";
import { planIntegrations } from "./planner.js";
import { takumiIntegration } from "./takumi/index.js";
import { shikiIntegration } from "./shiki/index.js";
import { mermaidIntegration } from "./mermaid/index.js";
import { sigmaIntegration } from "./sigma/index.js";
import { twoslashIntegration } from "./twoslash/index.js";
import { buildProjectKnowledge } from "../intelligence/build-knowledge.js";
import { discoverCliCommands } from "../intelligence/discovery/cli.js";
import { detectFramework } from "../intelligence/discovery/framework.js";
import { discoverExamples } from "../intelligence/discovery/examples.js";

interface LoggerLike {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

function createRegistry() {
  const registry = createIntegrationRegistry();
  for (const i of [
    takumiIntegration,
    shikiIntegration,
    mermaidIntegration,
    sigmaIntegration,
    twoslashIntegration,
  ]) {
    registry.register(i);
  }
  return registry;
}

export function registerIntegrationCommands(
  program: Command,
  options: { logger: LoggerLike; findRootDir(): string },
): void {
  const { logger, findRootDir } = options;
  const integrations = program.command("integrations").description("Manage ecosystem integrations");

  integrations
    .command("list")
    .description("List available integrations")
    .action(() => {
      const registry = createRegistry();
      logger.info("Available integrations:");
      for (const integration of registry.list()) {
        logger.info(
          `  ${integration.id} (${integration.packageName}) - ${integration.description}`,
        );
        logger.info(`    Capabilities: ${integration.capabilities.join(", ")}`);
      }
    });

  integrations
    .command("plan")
    .description("Show which integrations would be selected for this project and why")
    .action(async () => {
      const rootDir = findRootDir();
      const registry = createRegistry();
      const framework = detectFramework(rootDir);
      const examples = discoverExamples(rootDir);
      const discoveredCommands = discoverCliCommands(rootDir);
      const knowledge = await buildProjectKnowledge({
        rootDir,
        signals: {
          hasBin: discoveredCommands.length > 0,
          isMonorepo: false,
          framework: framework ?? undefined,
          configKeys: ["title"],
          commands: discoveredCommands,
          examples: examples.map((e) => e.title),
        },
        packageJson: {} as Record<string, unknown>,
      });
      const plan = await planIntegrations(registry, {
        projectKnowledge: knowledge,
        rootDir,
        config: {},
      });
      logger.info("Integration plan:");
      logger.info("Selected:");
      for (const sel of plan.selected) {
        logger.success(`  ${sel.id} - ${sel.description}`);
      }
      logger.info("Skipped:");
      for (const skip of plan.skipped) {
        logger.info(`  - ${skip.integration.id}: ${skip.reason}`);
      }
      logger.info("Dependencies to install:");
      for (const dep of plan.dependencies) {
        logger.info(`  ${dep.packageName}@${dep.version}`);
      }
    });

  integrations
    .command("validate")
    .description("Validate selected integrations")
    .action(async () => {
      const rootDir = findRootDir();
      const registry = createRegistry();
      const knowledge = await buildProjectKnowledge({
        rootDir,
        signals: {},
        packageJson: {} as Record<string, unknown>,
      });
      const plan = await planIntegrations(registry, {
        projectKnowledge: knowledge,
        rootDir,
        config: {},
      });
      let valid = true;
      for (const sel of plan.selected) {
        if (sel.validate) {
          const result = await sel.validate({ projectKnowledge: knowledge, rootDir, config: {} });
          if (!result.valid) {
            valid = false;
            logger.error(`  ${sel.id}: ${result.errors.join(", ")}`);
          } else {
            logger.success(`  ${sel.id}: valid`);
          }
          for (const warn of result.warnings) {
            logger.warn(`  warning: ${warn}`);
          }
        }
      }
      if (!valid) process.exit(1);
    });
}
