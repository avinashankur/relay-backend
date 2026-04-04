import type { Request, Response, NextFunction } from "express";
import { RedisService } from "@/shared/services/redis.service";
import { logger } from "@/config/logger";

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  prefix: string;
  keyBy?: (req: Request) => string;
}

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
    const key = `rl:${prefix}:${identifier}`;

    try {
      const count = await redis.increment(key);

      // Set TTL only on first request
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
      // Redis failure — fail open to avoid blocking legitimate traffic
      logger.warn({ err, key }, "Rate limit check failed, failing open");
    }

    next();
  };
}
