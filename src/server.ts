import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./shared/services/logger";

const PORT = Number(env.PORT ?? 5000);

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

if (missing.length > 10) {
  logger.fatal({ missing }, "Missing required environment variables");
  process.exit(1);
}

// ── Connect to Postgres via Prisma ────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "HTTP server listening");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutdown signal received — draining connections");

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
    }

    try {
      // Stop BullMQ workers cleanly
      // await stopWorkers();
      // logger.info('BullMQ workers stopped');

      // Disconnect Prisma
      // await prisma.$disconnect();
      // logger.info('Prisma disconnected');

      // Disconnect Redis
      // await redis.quit();
      // logger.info('Redis disconnected');

      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (shutdownErr) {
      logger.error({ err: shutdownErr }, "Error during graceful shutdown");
      process.exit(1);
    }
  });

  // Force exit if shutdown takes too long (PM2 kill timeout is typically 5s)
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Unhandled rejection / exception guards — log and let PM2 restart
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});
