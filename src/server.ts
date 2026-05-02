import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectRedis, redis, redisConnection } from "./config/redis";
import { shutdownEmailWorker } from "./workers/email/email.worker";
import { emailQueue } from "./workers/email/email.queue";
import {
  createCleanupWorker,
  shutdownCleanupWorker,
} from "./workers/cleanup/cleanup.worker";
import { createCleanupQueue } from "./workers/cleanup/cleanup.queue";
import { prisma } from "./config/prisma";
import { AuditService } from "./shared/services/audit.service";
import { RedisService } from "./shared/services/redis.service";
import { Redis as IORedis } from "ioredis";

const PORT = Number(env.PORT);
const { app, auditFlushInterval } = createApp();

// ── Validate critical environment variables ───────────────────────────────
const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "RESEND_API_KEY",
  "NODE_ENV",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  logger.fatal({ missing }, "Missing required environment variables");
  process.exit(1);
}

// Connect to Redis
connectRedis().catch((err) => {
  logger.error({ err }, "Failed to connect to Redis");
});

// ── Bootstrap background workers ──────────────────────────────────────────
// The cleanup worker and queue are process-lifecycle resources; they are
// created here (not inside createApp) so server.ts owns their teardown.
const redisService = new RedisService(redis);
const auditService = new AuditService(prisma, redisService);

// ioredis connection used exclusively by BullMQ workers/queues (separate from
// the node-redis client used for application caching / session logic).
const ioredisClient = new IORedis({
  ...redisConnection,
  // BullMQ workers use blocking Redis commands (e.g. BLMOVE) that can
  // legitimately block for seconds. maxRetriesPerRequest must be null so
  // ioredis does not abort those commands after a finite retry window.
  // enableReadyCheck: false is the complementary BullMQ recommendation.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const cleanupQueue = createCleanupQueue(ioredisClient);
const cleanupWorker = createCleanupWorker(prisma, auditService, ioredisClient);

logger.info("Cleanup worker and queue started");

// ── Connect to Postgres via Prisma ────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(
    { port: PORT },
    `HTTP server listening on http://localhost:${PORT}`,
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
/**
 * Shutdown order:
 *  1. Stop accepting new HTTP connections.
 *  2. Clear the audit flush interval (avoid writes during teardown).
 *  3. Close BullMQ workers  (drain in-flight jobs first).
 *  4. Close BullMQ queues (release their Redis connections).
 *  5. Disconnect Prisma (no more DB writes after this).
 *  6. Quit Redis clients.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  // Force exit if graceful shutdown takes too long
  const timeoutId = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);

  server.close(async (err) => {
    if (
      err &&
      (err as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING"
    ) {
      logger.error({ err }, "Error closing HTTP server");
    } else {
      logger.info("HTTP server closed");
    }

    try {
      // 1. Stop the audit flush timer so no new writes start during teardown.
      clearInterval(auditFlushInterval);
      logger.info("Audit flush interval cleared");

      // 2. Drain in-flight BullMQ jobs, then release their connections.
      //    Workers must be closed before queues so any active job can finish
      //    and mark itself complete/failed before the queue connection drops.
      await shutdownEmailWorker();
      await shutdownCleanupWorker(cleanupWorker);

      // 3. Close the BullMQ Queue connection handles (separate from workers).
      await emailQueue.close();
      await cleanupQueue.close();
      logger.info("BullMQ queues closed");

      // 4. Disconnect Prisma — no DB calls may occur after this point.
      await prisma.$disconnect();
      logger.info("Prisma disconnected");

      // 5. Quit both Redis clients.
      await redis.quit();
      await ioredisClient.quit();
      logger.info("Redis disconnected");

      logger.info("Shutdown complete");
    } catch (shutdownError) {
      logger.error({ err: shutdownError }, "Error during shutdown");
      process.exit(1);
    } finally {
      clearTimeout(timeoutId);
      process.exit(0);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
