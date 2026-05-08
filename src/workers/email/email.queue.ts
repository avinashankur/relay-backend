import { Queue, type JobsOptions } from "bullmq";
import { redisConnection } from "@/config/redis";

export enum EmailJobName {
  SendVerification = "send-verification",
  SendMagicLink = "send-magic-link",
  SendOtp = "send-otp",
  SendPasswordReset = "send-password-reset",
  SendSecurityAlert = "send-security-alert",
  SendDemo = "send-demo",
}

// ── Retry / backoff policy ────────────────────────────────────────────────────
//
// Standard jobs  — 4 attempts, exponential backoff + ±20 % jitter:
//   attempt 1 → 2 s, 2 → 4 s, 3 → 8 s, 4 → 16 s  (≈ 30 s total window)
//
// Critical jobs  — 6 attempts, same backoff curve:
//   attempt 1 → 2 s, …, 6 → 64 s  (≈ 2 min total window)
//
// Jitter is applied at enqueue time by adding a random 0‒40 % fraction
// of the computed delay. BullMQ does not natively support jitter, so we
// derive it via a custom backoff strategy on the Worker (see email.worker.ts).
//
// Dead-letter retention: BullMQ does not provide a separate DLQ queue;
// exhausted jobs land in the failed set. We keep the last 1 000 failed jobs
// so operators can inspect and replay them via the Bull Board dashboard or
// the BullMQ CLI. Jobs in the failed set are queryable and re-queueable.
// See TODO.md [EMAIL-04].

/** Base delay for the exponential backoff curve, in milliseconds. */
export const EMAIL_BACKOFF_BASE_MS = 2_000;

/** Job options applied to every non-critical transactional email. */
export const EMAIL_JOB_OPTIONS_DEFAULT: JobsOptions = {
  attempts: 4,
  backoff: {
    type: "custom", // handled by the backoff strategy in email.worker.ts
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1_000 }, // DLQ retention: keep last 1 000 failed jobs
};

/**
 * Job options for security-critical emails (security alerts).
 * Higher attempt ceiling; priority 1 (lowest number = highest priority)
 * so these bypass a backed-up standard queue.
 */
export const EMAIL_JOB_OPTIONS_CRITICAL: JobsOptions = {
  ...EMAIL_JOB_OPTIONS_DEFAULT,
  attempts: 6,
  priority: 1,
};

export interface SendVerificationJobData {
  userId: string;
  email: string;
  token: string;
}

export interface SendMagicLinkJobData {
  email: string;
  token: string;
}

export interface SendOtpJobData {
  email: string;
  code: string;
}

export interface SendPasswordResetJobData {
  userId: string;
  email: string;
  token: string;
}

export interface SendSecurityAlertJobData {
  userId: string;
  email: string;
  ip?: string;
  userAgent?: string;
  scheduledAt?: Date; // for account deletion
  alertType:
    | "token_reuse"
    | "suspicious_login"
    | "password_changed"
    | "account_deletion";
}

export interface SendDemoJobData {
  email: string;
}

export type EmailJobData =
  | { name: EmailJobName.SendVerification; data: SendVerificationJobData }
  | { name: EmailJobName.SendMagicLink; data: SendMagicLinkJobData }
  | { name: EmailJobName.SendOtp; data: SendOtpJobData }
  | { name: EmailJobName.SendPasswordReset; data: SendPasswordResetJobData }
  | { name: EmailJobName.SendSecurityAlert; data: SendSecurityAlertJobData }
  | { name: EmailJobName.SendDemo; data: SendDemoJobData };

export const EMAIL_QUEUE_NAME = "email";

/**
 * Singleton BullMQ Queue for all outbound transactional emails.
 *
 * defaultJobOptions here serve as the absolute last-resort fallback; callers
 * (EmailService) should always pass EMAIL_JOB_OPTIONS_DEFAULT or
 * EMAIL_JOB_OPTIONS_CRITICAL explicitly so the policy constants above are the
 * live source of truth.
 *
 * Actual processing happens in src/workers/email/email.worker.ts.
 * See TODO.md [EMAIL-04].
 */
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: EMAIL_JOB_OPTIONS_DEFAULT,
});
