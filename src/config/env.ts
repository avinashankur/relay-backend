import { z } from "zod";

const envSchema = z.object({
  // ─── App ──────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  API_BASE_URL: z.string().url(),

  // ─── Database (Neon Postgres) ─────────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  /**
   * Used for direct (non-pooled) connections — required by Prisma Migrate.
   * In Neon this is the "direct connection" string (no PgBouncer).
   */
  DATABASE_DIRECT_URL: z.string().url(),

  // ─── Redis ────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().url(),

  // ─── JWT (RS256) ──────────────────────────────────────────────────────────
  /**
   * PEM-encoded RSA private key used to sign access tokens.
   * In production this is loaded from AWS Secrets Manager at startup;
   * in dev/test you can paste the PEM (newlines replaced with \n) here.
   */
  JWT_PRIVATE_KEY: z.string().min(1),
  /**
   * PEM-encoded RSA public key used to verify access tokens.
   * Must match JWT_PRIVATE_KEY.
   */
  JWT_PUBLIC_KEY: z.string().min(1),
  /** Access token lifetime in seconds. Default: 900 (15 min). */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Refresh token lifetime in seconds. Default: 2592000 (30 days). */
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2_592_000),

  // ─── OAuth ────────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),

  // ─── Email (Resend) ───────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z
    .string()
    .email()
    .default("IdentityCore <noreply@identitycore.dev>"),

  // ─── AWS ──────────────────────────────────────────────────────────────────
  AWS_REGION: z.string().min(1).default("us-east-1"),
  /**
   * ARN of the AWS Secrets Manager secret that holds JWT keys, DB creds,
   * and OAuth secrets in production. Not required in development/test.
   */
  AWS_SECRETS_ARN: z.string().optional(),

  // ─── Sentry ───────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),

  // ─── CSRF ────────────────────────────────────────────────────────────────
  /**
   * Secret used to sign the CSRF double-submit cookie.
   * Must be at least 32 characters.
   */
  CSRF_SECRET: z.string().min(32),

  // ─── Cookie ───────────────────────────────────────────────────────────────
  /**
   * Domain for Set-Cookie headers (e.g. ".identitycore.dev").
   * Leave unset in local dev to default to localhost.
   */
  COOKIE_DOMAIN: z.string().optional(),

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  /** Global per-IP rate limit (requests per minute). Default: 1000. */
  RATE_LIMIT_GLOBAL_RPM: z.coerce.number().int().positive().default(1000),
  /** Login endpoint per-IP limit (attempts per minute). Default: 5. */
  RATE_LIMIT_LOGIN_RPM: z.coerce.number().int().positive().default(5),

  // ─── BullMQ ───────────────────────────────────────────────────────────────
  /**
   * Optional separate Redis URL for BullMQ queues.
   * Falls back to REDIS_URL when not set.
   */
  BULLMQ_REDIS_URL: z.string().url().optional(),

  // ─── Frontend ─────────────────────────────────────────────────────────────
  /** Allowed CORS origin(s) — comma-separated list of URLs. */
//   CORS_ORIGINS: z
//     .string()
//     .transform((val) => val.split(",").map((s) => s.trim()))
//     .default("http://localhost:3001"),

  // ─── Misc ─────────────────────────────────────────────────────────────────
  /** Log level for Pino. Default: "info". */
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    console.error(
      `\n[IdentityCore] ❌ Invalid environment variables:\n${formatted}\n`,
    );
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated, typed environment variables.
 * Importing this module at startup will call process.exit(1) if any
 * required variable is missing or malformed — fail fast, fail loud.
 */
export const env: Env = parseEnv();
