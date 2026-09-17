import type { Logger } from "../../types/internal.js";
import { createLoggerSync } from "../../logger/index.js";
import type { ServiceFactory } from "../container.js";

/**
 * Logger service — owns the engine's logging surface.
 *
 * Wraps the existing `createLoggerSync` implementation so consumers depend
 * on the service rather than the concrete factory.
 */
export interface LoggerService {
  readonly logger: Logger;
}

export const LOGGER_SERVICE = "logger";

export const loggerServiceFactory: ServiceFactory<LoggerService> = () => ({
  logger: createLoggerSync(),
});
