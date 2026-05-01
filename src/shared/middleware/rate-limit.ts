import type { Request, Response, NextFunction } from "express";
import { RedisService } from "@/shared/services/redis.service";
import { logger } from "@/config/logger";

interface RateLimitOptions {
  /**
   * Redis key namespace. Do NOT include a leading `rl:` — the middleware
   * adds that automatically so all rate-limit keys share a consistent
   * namespace without double-prefixing.
   *
   * Good:   `{ prefix: "login" }`   → key: `rl:login:<ip>`
   * Bad:    `{ prefix: "rl:login" }` → key: `rl:rl:login:<ip>` (double-prefix bug)
   */
  prefix: string;
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Sliding window length in seconds. */
  windowSeconds: number;
  /** Custom key extractor. Defaults to `req.ip`. */
  keyBy?: (req: Request) => string;
}

/**
 * Redis-backed rate limiter using a fixed window counter.
 *
 * Sets standard `X-RateLimit-*` headers on every response and returns
 * HTTP 429 with `Retry-After` once the limit is exceeded.
 *
 * Fail-open: if Redis is unreachable the request is allowed through and
 * a warning is logged — rate limiting should never block legitimate traffic
 * due to an infrastructure fault.
 *
 * See TODO.md [SEC-05].
 */
export function createRateLimit(
  redis: RedisService,
  options: RateLimitOptions,
) {
  const { limit, windowSeconds, prefix, keyBy } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const identifier = keyBy ? keyBy(req) : (req.ip ?? "unknown");
    // Consistent namespace: all rate-limit keys are `rl:<prefix>:<id>`
    const key = `rl:${prefix}:${identifier}`;

    try {
      const count = await redis.increment(key);

      // Set TTL only on the first request in the window so the window is
      // anchored to the first request, not reset on each subsequent one.
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, limit - count);
      const ttl = await redis.ttl(key);

      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + ttl);

      if (count > limit) {
        res.setHeader("Retry-After", ttl);
        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        });
        return;
      }
    } catch (err) {
      // Redis failure — fail open to avoid blocking legitimate traffic.
      logger.warn({ err, key }, "Rate limit check failed, failing open");
    }

    next();
  };
}
