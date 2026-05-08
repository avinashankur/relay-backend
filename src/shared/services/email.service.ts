import {
  emailQueue,
  EmailJobName,
  EMAIL_JOB_OPTIONS_DEFAULT,
  EMAIL_JOB_OPTIONS_CRITICAL,
  type SendVerificationJobData,
  type SendMagicLinkJobData,
  type SendOtpJobData,
  type SendPasswordResetJobData,
  type SendSecurityAlertJobData,
  type SendDemoJobData,
} from "@/workers/email/email.queue";
import type { Queue } from "bullmq";
import { logger } from "@/config/logger";

// Job option constants live in email.queue.ts — EMAIL_JOB_OPTIONS_DEFAULT and
// EMAIL_JOB_OPTIONS_CRITICAL are imported above. Do not define them here.
// See TODO.md [EMAIL-04].

export class EmailService {
  constructor(private readonly queue: Queue = emailQueue) {}

  /**
   * Enqueue a verification email for a newly signed-up user.
   * The link in the email hits GET /auth/verify-email?token={raw_token}
   */
  async sendVerificationEmail(
    payload: SendVerificationJobData,
  ): Promise<string> {
    const job = await this.queue.add(
      EmailJobName.SendVerification,
      payload,
      EMAIL_JOB_OPTIONS_DEFAULT,
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
      EmailJobName.SendMagicLink,
      payload,
      EMAIL_JOB_OPTIONS_DEFAULT,
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
    const job = await this.queue.add(
      EmailJobName.SendOtp,
      payload,
      EMAIL_JOB_OPTIONS_DEFAULT,
    );
    logger.info(
      { jobId: job.id, email: payload.email },
      "Enqueued send-otp email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a password reset email.
   * The link carries a token for POST /auth/password-reset with a new password.
   */
  async sendPasswordReset(payload: SendPasswordResetJobData): Promise<string> {
    const job = await this.queue.add(
      EmailJobName.SendPasswordReset,
      payload,
      EMAIL_JOB_OPTIONS_DEFAULT,
    );
    logger.info(
      { jobId: job.id, userId: payload.userId, email: payload.email },
      "Enqueued send-password-reset email job",
    );
    return job.id!;
  }

  /**
   * Enqueue a security alert email (CRITICAL priority, 6 retries).
   */
  async sendSecurityAlert(payload: SendSecurityAlertJobData): Promise<string> {
    const job = await this.queue.add(
      EmailJobName.SendSecurityAlert,
      payload,
      EMAIL_JOB_OPTIONS_CRITICAL,
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
      EMAIL_JOB_OPTIONS_DEFAULT,
    );
    logger.info(
      { jobId: job.id, email: payload.email },
      "Enqueued send-demo email job",
    );
    return job.id!;
  }
}

export const emailService = new EmailService();
