import {
  emailQueue,
  EmailJobName,
  type SendVerificationJobData,
  type SendMagicLinkJobData,
  type SendOtpJobData,
  type SendPasswordResetJobData,
  type SendSecurityAlertJobData,
  type SendDemoJobData,
} from "@/workers/email/email.queue";
import type { Queue } from "bullmq";
import { logger } from "@/config/logger";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1_000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

const CRITICAL_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5,
  priority: 1,
};

export class EmailService {
  constructor(private readonly queue: Queue = emailQueue) {}

  /**
   * Enqueue a verification email for a newly signed-up user.
   * The link in the email hits POST /auth/email/verify?token={raw_token}
   */
  async sendVerificationEmail(
    payload: SendVerificationJobData,
  ): Promise<string> {
    const job = await this.queue.add(
      "send-verification",
      payload,
      DEFAULT_JOB_OPTIONS,
    );
    logger.info(
      { jobId: job.id, userId: payload.userId, email: payload.email },
      "Enqueued send-verification email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a magic link email.
   * The link hits GET /auth/magic-link/callback?token={raw_token}
   */
  async sendMagicLink(payload: SendMagicLinkJobData): Promise<string> {
    const job = await this.queue.add(
      "send-magic-link",
      payload,
      DEFAULT_JOB_OPTIONS,
    );
    logger.info(
      { jobId: job.id, email: payload.email },
      "Enqueued send-magic-link email job",
    );
    return job.id!;
  }

  /**
   * Enqueue an OTP email.
   * The 6-digit code is included directly in the email body.
   */
  async sendOtp(payload: SendOtpJobData): Promise<string> {
    const job = await this.queue.add("send-otp", payload, DEFAULT_JOB_OPTIONS);
    logger.info(
      { jobId: job.id, email: payload.email },
      "Enqueued send-otp email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a password reset email.
   * The link hits POST /auth/password/reset with token + new password.
   */
  async sendPasswordReset(payload: SendPasswordResetJobData): Promise<string> {
    const job = await this.queue.add(
      "send-password-reset",
      payload,
      DEFAULT_JOB_OPTIONS,
    );
    logger.info(
      { jobId: job.id, userId: payload.userId, email: payload.email },
      "Enqueued send-password-reset email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a security alert email (CRITICAL priority, 5 retries).
   */
  async sendSecurityAlert(payload: SendSecurityAlertJobData): Promise<string> {
    const job = await this.queue.add(
      "send-security-alert",
      payload,
      CRITICAL_JOB_OPTIONS,
    );
    logger.warn(
      {
        jobId: job.id,
        userId: payload.userId,
        email: payload.email,
        alertType: payload.alertType,
      },
      "Enqueued CRITICAL send-security-alert email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a demo/test email. For development and delivery-pipeline testing only.
   */
  async sendDemoEmail(payload: SendDemoJobData): Promise<string> {
    const job = await this.queue.add(
      EmailJobName.SendDemo,
      payload,
      DEFAULT_JOB_OPTIONS,
    );
    logger.info(
      { jobId: job.id, email: payload.email },
      "Enqueued send-demo email job",
    );
    return job.id!;
  }
}

export const emailService = new EmailService();
