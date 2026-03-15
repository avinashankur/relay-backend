import { type RedisClientType } from "redis";
import { logger } from "./logger";

export class RedisService {
  constructor(private readonly client: RedisClientType) {}

  // Core string ops

  /**
   * Store a string value with a TTL (seconds).
   */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  /**
   * Retrieve a value. Returns null if the key does not exist or has expired.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Delete one or more keys. No-op if a key does not exist.
   */
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(keys);
  }

  /**
   * Check whether a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Counters
  /**
   * Atomically increment a counter and return the new value.
   * Creates the key with value 1 if it does not exist.
   */
  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  // TTL Management
  /**
   * Set / refresh expiry (TTL in seconds) on an existing key.
   * Returns true if the TTL was applied, false if the key does not exist.
   * Note: In newer node-redis versions, client.expire() returns a number (1 or 0)
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSeconds);
    // return !!result; // 1 → true, 0 → false, other falsy → false
    return result === 1;
  }

  /**
   * Return the remaining TTL of a key in seconds.
   * Returns -2 if the key does not exist, -1 if it has no expiry.
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // Conditional Set
  /**
   * Store a value only if the key does not already exist (SET NX EX).
   * Returns true if the key was set, false if it already existed.
   * Useful for distributed one-time tokens or deduplication guards.
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === "OK";
  }

  // JSON helpers
  /**
   * Retrieve and parse a JSON value.
   * Returns null if the key does not exist.
   */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.error(
        `Failed to parse JSON value from Redis for key "${key}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new Error(`Failed to parse JSON value from Redis for key "${key}"`);
    }
  }

  /**
   * Serialise a value as JSON and store it with a TTL (seconds).
   */
  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // List ops ( used by AuditService buffer )
  /**
   * Append one or more values to the tail of a list (RPUSH).
   * Returns the new list length.
   */
  async rPush(key: string, ...values: string[]): Promise<number> {
    return this.client.rPush(key, values);
  }

  /**
   * Return the length of a list.
   */
  async lLen(key: string): Promise<number> {
    return this.client.lLen(key);
  }

  // Pipeline / multi
  /**
   * Execute a batch of commands in a single pipeline (MULTI/EXEC).
   * Use for operations that must be atomic or where round-trips matter.
   *
   * Example:
   *   await redis.pipeline(async (multi) => {
   *     multi.set('foo', 'bar', { EX: 60 });
   *     multi.incr('counter');
   *   });
   */
  async pipeline(
    fn: (multi: ReturnType<RedisClientType["multi"]>) => void,
  ): Promise<unknown[]> {
    const multi = this.client.multi();
    fn(multi);
    return multi.exec();
  }

  // Per command timeout
  /**
   * Get a value with a per-command timeout (ms).
   * Rejects with a timeout error if it takes too long.
   */
  async getWithTimeout(key: string, timeoutMs: number): Promise<string | null> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      // Use AbortSignal-aware command options so the Redis command can be aborted on timeout.
      return await this.client.get(key, { signal: abortController.signal as AbortSignal });
    } catch (err: unknown) {
      // If the command was aborted due to our timeout, translate to a consistent timeout error.
      if (
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"))
      ) {
        throw new Error(
          `Redis GET timed out after ${timeoutMs}ms for key: ${key}`,
        );
      }

      // Re-throw any real Redis errors
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  //  Escape hatch
  /**
   * Expose the raw node-redis client for operations not covered above.
   * Use sparingly -- prefer adding a typed method to this service instead.
   */
  get raw(): RedisClientType {
    return this.client;
  }

  // Lifecycle
  /**
   * Gracefully close the connection.
   * Call during server shutdown after all in-flight requests complete.
   */
  async quit(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      logger.warn({ err }, "RedisService: error during quit");
    }
  }
}
