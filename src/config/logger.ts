import pino, { type Logger, type LoggerOptions } from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const devTransport: LoggerOptions["transport"] = {
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "SYS:HH:MM:ss.l",
    ignore: "pid,hostname",
    messageFormat: "{requestId} {msg}",
  },
};

const options: LoggerOptions = {
  // Silence logs entirely during unit/integration test runs unless explicitly
  // enabled — keeps test output clean.
  level:
    isTest && process.env.LOG_LEVEL === undefined
      ? "silent"
      : (process.env.LOG_LEVEL ?? (isDev ? "debug" : "info")),

  // Base fields attached to every log line
  base: {
    env: process.env.NODE_ENV ?? "production",
    // pid and hostname are included by default; keep them in prod for
    // CloudWatch / ELK correlation but strip them in pretty-print via ignore
  },

  // Redact PII / secrets before any log line is written
  redact: {
    paths: [
      "email",
      "*.email",
      "password",
      "*.password",
      "credential",
      "*.credential",
      "token",
      "*.token",
      "refreshToken",
      "*.refreshToken",
      "accessToken",
      "*.accessToken",
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    censor: "[REDACTED]",
  },

  // Millisecond-precision ISO timestamp matching the PRD log example:
  // "time": "2026-03-01T12:00:00.000Z"
  timestamp: pino.stdTimeFunctions.isoTime,

  // Map pino level numbers to a human-readable "level" string so that
  // CloudWatch Logs Insights / ELK can filter on level:"error" etc.
  formatters: {
    level(label) {
      return { level: label };
    },
    // Include the requestId in every child-logger line automatically when
    // it has been bound via logger.child({ requestId })
    log(obj) {
      return obj;
    },
  },

  // Use pino-pretty in dev; raw JSON in staging / prod
  transport: isDev ? devTransport : undefined,
};

export const logger: Logger = pino(options);

// ── Typed child-logger helpers ────────────────────────────────────────────────
// Call these at the start of a request or background job to get a logger that
// automatically includes the relevant correlation IDs on every line.

export interface RequestContext {
  requestId: string;
  userId?: string;
  orgId?: string;
  route?: string;
  ip?: string;
}

export interface JobContext {
  jobId: string | undefined;
  queue: string;
  jobName: string;
  /** Current attempt number (1-based), if available. */
  attempt?: number;
}

export function requestLogger(ctx: RequestContext): Logger {
  return logger.child(ctx);
}

export function jobLogger(ctx: JobContext): Logger {
  return logger.child(ctx);
}
