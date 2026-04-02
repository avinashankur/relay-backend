import { Queue } from "bullmq";
import { redisConnection } from "@/config/redis";

export enum EmailJobName {
  SendVerification = "send-verification",
  SendMagicLink = "send-magic-link",
  SendOtp = "send-otp",
  SendPasswordReset = "send-password-reset",
  SendSecurityAlert = "send-security-alert",
}

export interface SendVerificationJobData {
  userId: string;
  email: string;
  token: string;
}

export interface SendMagicLinkJobData {
  email: string;
  token: string;
  redirectUrl: string;
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
  alertType: "token_reuse" | "suspicious_login" | "password_changed";
}

export type EmailJobData =
  | { name: EmailJobName.SendVerification; data: SendVerificationJobData }
  | { name: EmailJobName.SendMagicLink; data: SendMagicLinkJobData }
  | { name: EmailJobName.SendOtp; data: SendOtpJobData }
  | { name: EmailJobName.SendPasswordReset; data: SendPasswordResetJobData }
  | { name: EmailJobName.SendSecurityAlert; data: SendSecurityAlertJobData };

export const EMAIL_QUEUE_NAME = "email";

/**
 * Singleton BullMQ Queue for all outbound transactional emails.
 *
 *  defaultJobOptions apply to every job unless overridden at enqueue time.
 *  The email.service.ts overrides attempts/priority for critical jobs
 *   (e.g. send-security-alert gets 5 retries + priority 1).
 *  Actual processing happens in src/workers/email/email.worker.ts.
 */
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1_000, // 1s -> 2s -> 4s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
