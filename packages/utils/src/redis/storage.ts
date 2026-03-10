import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";
import { env } from "../env";
import { RATE_LIMIT_REDIS_NAMESPACE } from "./namespaces";

let redisStorage: ReturnType<typeof createStorage> | null = null;

export function getRatelimiterRedisStorage() {
  if (redisStorage) {
    return redisStorage;
  }

  redisStorage = createStorage({
    driver: redisDriver({
      url: env.REDIS_URL,
      base: RATE_LIMIT_REDIS_NAMESPACE,
      preConnect: true,
    }),
  });

  return redisStorage;
}
