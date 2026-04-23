import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectRedis, redis } from "./config/redis";
import { shutdownEmailWorker } from "./workers/email/email.worker";
import { prisma } from "./config/prisma";

const PORT = Number(env.PORT);
const app = createApp();

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

// ── Connect to Postgres via Prisma ────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(
    { port: PORT },
    `HTTP server listening on http://localhost:${PORT}`,
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
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
      await shutdownEmailWorker();
      await prisma.$disconnect();
      await redis.quit();
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
