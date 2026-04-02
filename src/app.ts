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

export function createApp(): Application {
  const app = express();

  // Security headers ————————————————————————————————————————————
  app.use(helmet({}));

  // Request parsing
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: true, limit: "256kb" }));

  app.use(pinoHttp({ logger }));
  app.use(cookieParser());

  // Dependency wiring ————————————————————————————————————————————
  const authService = new AuthService(prisma, new PasswordStrategy());

  // Routes here ——————————————————————————————————————————————————
  // Health Endpoints

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", (_req, res) => {
    try {
      // check prisma and redis health
    } catch (error) {
      logger.error({ error }, "Readiness check failed");
      res.status(503).json({ status: "unavailable" });
    }
  });

  // Auth Endpoint
  app.use("/api/v1/auth", createAuthRouter(authService));

  // 404 catch-all
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  return app;
}
