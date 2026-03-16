import Redis from "ioredis";
import { env } from "../env";

let redisClient: Redis | null = null;
let redisConnectPromise: Promise<Redis> | null = null;

function createRedisClient() {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    enableAutoPipelining: true,
    keepAlive: 10_000,
    connectionName: "proptryx-shared",
  });

  client.on("error", (error) => {
    // Avoid unhandled error events bringing the process down.
    console.warn("redis connection error", error);
  });

  return client;
}

export function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createRedisClient();
  return redisClient;
}

export async function initializeRedisClient() {
  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const client = getRedisClient();
  if (client.status === "ready") {
    return client;
  }

  if (client.status === "connecting" || client.status === "connect") {
    redisConnectPromise = new Promise<Redis>((resolve, reject) => {
      const cleanup = () => {
        client.off("ready", handleReady);
        client.off("error", handleError);
      };

      const handleReady = () => {
        cleanup();
        redisConnectPromise = null;
        resolve(client);
      };

      const handleError = (error: unknown) => {
        cleanup();
        redisConnectPromise = null;
        reject(error);
      };

      client.once("ready", handleReady);
      client.once("error", handleError);
    });

    return redisConnectPromise;
  }

  redisConnectPromise = client.connect().then(() => {
    redisConnectPromise = null;
    return client;
  });

  return redisConnectPromise;
}

export async function closeRedisClient() {
  if (!redisClient) {
    return;
  }

  const client = redisClient;
  redisClient = null;
  redisConnectPromise = null;
  await client.quit();
}
