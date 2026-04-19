import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger";
import cookieParser from "cookie-parser";
import { AuthService } from "./modules/auth/auth.service";
import { PasswordStrategy } from "./modules/auth/strategies/password.strategy";
import { prisma } from "./config/prisma";
import { createAuthRouter } from "./modules/auth/auth.router";
import { AuditService } from "./shared/services/audit.service";
import { SessionService } from "./modules/sessions/sessions.service";
import { Queue } from "bullmq";
import { RedisService } from "./shared/services/redis.service";
import { redis, redisConnection } from "./config/redis";
import { CryptoService } from "./shared/services/crypto.service";
import type { EmailJobData } from "./workers/email/email.queue";
import { EmailService } from "./shared/services/email.service";
import { failure, success } from "./shared/utils/response";
import { errorHandler } from "./shared/middleware/error-handler";
import { OtpStrategy } from "./modules/auth/strategies/otp.strategy";
import { createUserRouter } from "./modules/users/user.router";
import { UserService } from "./modules/users/users.service";
import { createAdminRouter } from "./modules/admin/admin.router";

const AUDIT_FLUSH_INTERVAL_MS = 30_000;

async function withTimeout<T>(
  label: string,
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} check timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet({}));

  // Request parsing
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: true, limit: "256kb" }));

  app.use(pinoHttp({ logger }));
  app.use(cookieParser());

  // Dependency wiring
  const passwordStrategy = new PasswordStrategy();
  const redisService = new RedisService(redis);
  const cryptoService = new CryptoService();
  const otpStrategy = new OtpStrategy(cryptoService, redisService);
  const emailQueue = new Queue<EmailJobData>("email", {
    connection: redisConnection,
  });
  const emailService = new EmailService(emailQueue);
  const auditService = new AuditService(prisma, redisService);

  // Drain Redis-buffered audit events to Postgres on a fixed cadence.
  const auditFlushInterval = setInterval(() => {
    auditService
      .flush()
      .catch((err) => logger.error({ err }, "Periodic audit flush failed"));
  }, AUDIT_FLUSH_INTERVAL_MS);
  auditFlushInterval.unref();

  const sessionService = new SessionService(
    prisma,
    auditService,
    cryptoService,
    emailService,
    redisService,
  );

  const userService = new UserService(
    prisma,
    auditService,
    sessionService,
    emailService,
  );

  const authService = new AuthService(
    prisma,
    passwordStrategy,
    otpStrategy,
    auditService,
    sessionService,
    cryptoService,
    redisService,
    emailService,
  );

  // Routes here
  // Health Endpoints
  app.get("/health", (_req, res) => {
    res.status(200).json(success({ status: "ok" }));
  });

  app.get("/health/ready", async (_req, res) => {
    try {
      // check prisma and redis health
      await withTimeout("prisma", prisma.$queryRaw`SELECT 1`, 3000);
      await withTimeout("redis", redis.ping(), 2000);

      return res.status(200).json(success({ status: "ready" }));
    } catch (error) {
      logger.error({ error }, "Readiness check failed");
      return res
        .status(503)
        .json(failure("SERVICE_UNAVAILABLE", "Service is not ready"));
    }
  });

  // Auth Endpoint
  app.use(
    "/api/v1/auth",
    createAuthRouter(authService, sessionService, redisService),
  );

  // User Endpoint
  app.use("/api/v1/user", createUserRouter(userService));

  // Admin Endpoint (requires auth + admin role)
  app.use(
    "/api/v1/admin",
    createAdminRouter(prisma, sessionService, auditService),
  );

  // 404 catch-all
  app.use((_req: Request, res: Response) => {
    res.status(404).json(failure("NOT_FOUND", "Route not found"));
  });

  app.use(errorHandler);

  return app;
}
