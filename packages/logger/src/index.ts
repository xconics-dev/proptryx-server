export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogFormat = "pretty" | "json";
type LogPayload = Record<string, unknown>;
type LogMethod = (message: string, payload?: LogPayload) => void;
type NextHandler = () => Promise<void>;
type HonoContextLike = {
  req: {
    method: string;
    path: string;
    header(name: string): string | undefined;
  };
  res: {
    status: number;
  };
  get?(key: string): unknown;
};
type MiddlewareHandler = (context: HonoContextLike, next: NextHandler) => Promise<void>;

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const ANSI = {
  reset: "\u001B[0m",
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  magenta: "\u001B[35m",
  gray: "\u001B[90m",
} as const;

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.cyan,
  info: ANSI.green,
  warn: ANSI.yellow,
  error: ANSI.red,
  fatal: ANSI.magenta,
};

const VALID_LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error", "fatal"]);
const VALID_LOG_FORMATS = new Set<LogFormat>(["pretty", "json"]);

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  child(bindings: LogPayload): Logger;
}

interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
  format?: LogFormat;
  colorEnabled?: boolean;
  bindings?: LogPayload;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) {
    return "info";
  }

  const normalized = value.toLowerCase() as LogLevel;
  return VALID_LOG_LEVELS.has(normalized) ? normalized : "info";
}

function parseLogFormat(value: string | undefined): LogFormat {
  if (!value) {
    return process.env.NODE_ENV === "production" ? "json" : "pretty";
  }

  const normalized = value.toLowerCase() as LogFormat;
  return VALID_LOG_FORMATS.has(normalized) ? normalized : "pretty";
}

function parseColorEnabled(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }

  if (process.env.FORCE_COLOR) {
    return true;
  }

  return Boolean(process.stdout.isTTY);
}

function shouldLogHealthchecks(): boolean {
  const rawValue = process.env.LOG_HEALTHCHECKS?.toLowerCase();
  if (rawValue === "true" || rawValue === "1" || rawValue === "yes") {
    return true;
  }
  if (rawValue === "false" || rawValue === "0" || rawValue === "no") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function serializeError(error: unknown): LogPayload {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function normalizePayload(payload?: LogPayload): LogPayload | undefined {
  if (!payload) {
    return undefined;
  }

  if ("error" in payload) {
    return {
      ...payload,
      error: serializeError(payload.error),
    };
  }

  return payload;
}

function stringifyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[Circular]";
  }
}

function shortenUserAgent(userAgent: string | undefined, maxLength = 72): string | null {
  if (!userAgent) {
    return null;
  }

  const normalized = userAgent.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function getRequestId(context: HonoContextLike): string | null {
  const contextRequestId = context.get?.("requestId");
  if (typeof contextRequestId === "string" && contextRequestId.length > 0) {
    return contextRequestId;
  }

  return context.req.header("x-request-id") ?? context.req.header("request-id") ?? null;
}

function colorize(value: string, color: string, enabled: boolean): string {
  if (!enabled) {
    return value;
  }
  return `${color}${value}${ANSI.reset}`;
}

function formatPrettyTimestamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatPrettyLine(
  timestamp: string,
  level: LogLevel,
  service: string,
  message: string,
  payload: LogPayload | undefined,
  colorEnabled: boolean
): string {
  const time = colorize(timestamp, ANSI.dim, colorEnabled);
  const levelText = colorize(level.toUpperCase().padEnd(5), LEVEL_COLOR[level], colorEnabled);
  const serviceText = colorize(`[${service}]`, ANSI.gray, colorEnabled);

  const payloadText =
    payload && Object.keys(payload).length > 0
      ? ` ${Object.entries(payload)
          .map(([key, value]) => `${key}=${stringifyValue(value)}`)
          .join(" ")}`
      : "";

  return `${time} ${levelText} ${serviceText} ${message}${payloadText}`;
}

function createLoggerInstance(
  service: string,
  minLevel: LogLevel,
  format: LogFormat,
  colorEnabled: boolean,
  bindings: LogPayload = {}
): Logger {
  const minLevelRank = LOG_LEVEL_ORDER[minLevel];

  const log = (level: LogLevel, message: string, payload?: LogPayload) => {
    if (LOG_LEVEL_ORDER[level] < minLevelRank) {
      return;
    }

    const currentDate = new Date();
    const normalizedPayload = normalizePayload(payload);
    const record = {
      timestamp: currentDate.toISOString(),
      level,
      service,
      message,
      ...bindings,
      ...normalizedPayload,
    };

    const stream =
      LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER.error ? process.stderr : process.stdout;
    const line =
      format === "json"
        ? JSON.stringify(record)
        : formatPrettyLine(
            formatPrettyTimestamp(currentDate),
            level,
            service,
            message,
            { ...bindings, ...normalizedPayload },
            colorEnabled
          );
    stream.write(`${line}\n`);
  };

  return {
    debug: (message, payload) => log("debug", message, payload),
    info: (message, payload) => log("info", message, payload),
    warn: (message, payload) => log("warn", message, payload),
    error: (message, payload) => log("error", message, payload),
    fatal: (message, payload) => log("fatal", message, payload),
    child: (extraBindings) =>
      createLoggerInstance(service, minLevel, format, colorEnabled, {
        ...bindings,
        ...extraBindings,
      }),
  };
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return createLoggerInstance(
    options.service,
    options.level ?? "info",
    options.format ?? "pretty",
    options.colorEnabled ?? false,
    options.bindings
  );
}

export function createServiceLogger(service: string): Logger {
  return createLogger({
    service,
    level: parseLogLevel(process.env.LOG_LEVEL),
    format: parseLogFormat(process.env.LOG_FORMAT),
    colorEnabled: parseColorEnabled(),
  });
}

export function createHonoRequestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = Date.now();
    const isHealthcheckRoute = c.req.path === "/health";
    const logHealthchecks = shouldLogHealthchecks();

    try {
      await next();
    } catch (error) {
      logger.error("request failed", {
        method: c.req.method,
        path: c.req.path,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }

    const status = c.res.status;
    const message = `${c.req.method} ${c.req.path} ${status}`;
    const payload = {
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Date.now() - startedAt,
      userAgent: shortenUserAgent(c.req.header("user-agent")),
      requestId: getRequestId(c),
    };

    if (status >= 500) {
      logger.error(message, payload);
      return;
    }

    if (status >= 400) {
      logger.warn(message, payload);
      return;
    }

    // Docker/compose health probes can be very noisy in production logs.
    // Keep them only when explicitly enabled.
    if (isHealthcheckRoute && !logHealthchecks) {
      return;
    }

    logger.info(message, payload);
  };
}
