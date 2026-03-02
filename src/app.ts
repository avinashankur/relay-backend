import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./shared/services/logger";
import { randomUUID } from "crypto";

export const app = express();

// Security headers
app.use(helmet({}));

// Request parsing
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers["x-request-id"] as string) ?? randomUUID(),
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} → ${res.statusCode} — ${err.message}`,
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          ip: req.remoteAddress,
        };
      },
    },
  }),
);

// routes here

// ── 404 catch-all
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});
