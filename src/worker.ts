/**
 * Worker process entrypoint.
 *
 * Run this instead of server.ts when you want background jobs to execute in
 * a separate OS process or container. This file:
 *   - bootstraps its own Redis / ioredis connections
 *   - starts the email and cleanup BullMQ workers
 *   - owns a full graceful-shutdown sequence
 *   - never imports app.ts or starts an HTTP listener
 *
 * See TODO.md [EMAIL-03].
 */
import "dotenv/config";
import { Redis as IORedis } from "ioredis";
import { logger } from "./config/logger";
import { env } from "./config/env";
import { connectRedis, redis, redisConnection } from "./config/redis";
import { prisma } from "./config/prisma";
import { RedisService } from "./shared/services/redis.service";
import { AuditService } from "./shared/services/audit.service";

// Workers
import { shutdownEmailWorker } from "./workers/email/email.worker";
import { emailQueue } from "./workers/email/email.queue";
import {
  createCleanupWorker,
  shutdownCleanupWorker,
} from "./workers/cleanup/cleanup.worker";
import { createCleanupQueue } from "./workers/cleanup/cleanup.queue";
import { startQueueHealthLogger } from "./workers/queue-health";

// ── Validate required environment variables ──────────────────────────────────
const REQUIRED_ENV = [
  "DATABASE_URL",
  "REDIS_URL",
  "RESEND_API_KEY",
  "NODE_ENV",
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  logger.fatal({ missing }, "Worker: missing required environment variables");
  process.exit(1);
}

// ── Connect node-redis (used by AuditService / RedisService) ─────────────────
connectRedis().catch((err) => {
  logger.fatal({ err }, "Worker: failed to connect to Redis — aborting");
  process.exit(1);
});

// ── Build ioredis client for BullMQ ──────────────────────────────────────────
// BullMQ workers use blocking Redis commands (e.g. BLMOVE) that can
// legitimately block for seconds; maxRetriesPerRequest must be null so ioredis
// does not abort those commands after a finite retry window.
const ioredisClient = new IORedis({
  ...redisConnection,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

ioredisClient.on("error", (err) => {
  logger.error({ err }, "Worker ioredis client error");
});

// ── Shared service dependencies for cleanup worker ────────────────────────────
const redisService = new RedisService(redis);
const auditService = new AuditService(prisma, redisService);

// ── Start workers ─────────────────────────────────────────────────────────────
// Importing email.worker.ts registers the singleton Worker and its event
// listeners as a side-effect; shutdownEmailWorker() tears it down.
// The email queue handle is imported so we can close it during shutdown.
const cleanupQueue = createCleanupQueue(ioredisClient);
const cleanupWorker = createCleanupWorker(prisma, auditService, ioredisClient);

logger.info(
  { pid: process.pid, env: env.NODE_ENV },
  "Worker process started — email and cleanup workers running",
);

// ── Periodic queue health logger ──────────────────────────────────────────────
// Emits a structured queue-health snapshot log every 5 minutes so operators
// can spot queue growth, stuck active jobs, or dead-letter accumulation from
// CloudWatch / ELK without tailing raw BullMQ events.
// See TODO.md [EMAIL-05].
const QUEUE_HEALTH_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes
const stopQueueHealthLogger = startQueueHealthLogger(
  [emailQueue, cleanupQueue],
  QUEUE_HEALTH_INTERVAL_MS,
  {
    failedWarnThreshold: 50, // warn when dead-letter set exceeds 50 jobs
    activeWarnThreshold: 20, // warn when active count suggests saturation
  },
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
/**
 * Shutdown order:
 *  1. Drain in-flight BullMQ jobs (workers close first).
 *  2. Close BullMQ queue handles (releases their Redis connections).
 *  3. Disconnect Prisma (no DB writes after this).
 *  4. Quit both Redis clients.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Worker: ${signal} received — shutting down gracefully`);

  const timeoutId = setTimeout(() => {
    logger.error("Worker: graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 30_000); // workers may be draining long-running jobs — allow 30 s

  try {
    // 0. Stop the health-check timer so it cannot fire after queues close.
    stopQueueHealthLogger();

    // 1. Drain workers (wait for any active job to complete).
    await shutdownEmailWorker();
    await shutdownCleanupWorker(cleanupWorker);

    // 2. Close queue connection handles.
    await emailQueue.close();
    await cleanupQueue.close();
    logger.info("Worker: BullMQ queues closed");

    // 3. Disconnect Prisma.
    await prisma.$disconnect();
    logger.info("Worker: Prisma disconnected");

    // 4. Quit Redis clients.
    await redis.quit();
    await ioredisClient.quit();
    logger.info("Worker: Redis disconnected");

    logger.info("Worker: shutdown complete");
  } catch (err) {
    logger.error({ err }, "Worker: error during shutdown");
    process.exit(1);
  } finally {
    clearTimeout(timeoutId);
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Worker: unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Worker: uncaught exception — exiting");
  process.exit(1);
});
