import { createClient, type RedisClientType } from "redis";
import { env } from "./env";
import { logger } from "@/shared/services/logger";

export const redis: RedisClientType = createClient({
  url: env.REDIS_URL,

  socket: {
    // Exponential backoff

    // redis calls this function every time the connection dies unexpectedly
    /**
     * retries = how many times it already tried to reconnect (starts from 0 or 1 depending on version)
     * If you tried ≥ 10 times → stop forever (return Error = give up)
     * Otherwise → wait retries * 200 milliseconds, but never more than 10 seconds
     * 1st retry → wait ~200 ms
     * 2nd retry → wait ~400 ms
     * 3rd retry → wait ~600 ms
     * This is called exponential backoff (very common pattern — don't hammer the server too fast)
     */
    reconnectStrategy: (retries: number) => {
      if (retries >= 10) {
        logger.error("Redis: max reconnection attempts reached -- giving up");
        return new Error("Redis max retries exceeded");
      }

      const base = 200;
      const max = 10000;
      let delay = base * Math.pow(2, retries);
      delay = Math.min(delay, max);

      // Add jitter: randomize 50–100% of the delay
      delay = delay * (0.5 + Math.random() * 0.5);
      logger.warn({ retries, delayMs: delay }, "Redis: scheduling reconnect");

      return delay;
    },
    connectTimeout: 10_000, // 10s
  },

  /*
    When the connection is down, node-redis can queue your commands (SET, GET, etc.) and replay them when it reconnects
    false = yes, please queue them (default and usually what you want)
  */
  disableOfflineQueue: false,
});

redis.on("connect", () => logger.info("Redis Connected"));
redis.on("ready", () => logger.info("Redis ready"));
redis.on("error", (err: Error) => logger.error({ err }, "Redis client error"));
redis.on("end", () => logger.info("Redis connection ended"));
redis.on("reconnection", () => logger.warn("Redis reconnecting"));

/**
 * Explicitly connect to Redis.
 * Must be called once during app bootstrap before handling requests.
 * node-redis does NOT auto-connect on instantiation (unlike ioredis).
 */
export async function connectRedis(): Promise<void> {
  await redis.connect();
}
