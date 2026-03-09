import { initDB } from "./db";

type DBLogMeta = Record<string, unknown>;

type DBLogger = {
  info: (message: string, meta?: DBLogMeta) => void;
  error: (message: string, meta?: DBLogMeta) => void;
};

type InitDBMiddlewareOptions = {
  databaseUrl?: string;
  logger?: DBLogger;
  serviceName?: string;
};

type HonoLikeMiddleware = (context: unknown, next: () => Promise<void>) => Promise<void>;

export function initDBMiddleware(options: InitDBMiddlewareOptions = {}): HonoLikeMiddleware {
  return async (_context, next) => {
    await initDB(options);
    await next();
  };
}
