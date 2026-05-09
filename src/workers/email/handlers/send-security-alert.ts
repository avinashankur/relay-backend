import { env } from "@/config/env";
import { Resend } from "resend";
import type { Logger } from "pino";
import SecurityAlertEmail from "@/emails/SecurityAlertEmail";
import type { SendSecurityAlertJobData } from "../email.queue";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

const SUBJECTS: Record<SendSecurityAlertJobData["alertType"], string> = {
  token_reuse: "Security alert: suspicious session activity detected",
  suspicious_login: "Security alert: new sign-in to your account",
  password_changed: "Your password has been changed",
  account_deletion: "Your account is scheduled for deletion",
};

export async function sendSecurityAlert(
  data: SendSecurityAlertJobData,
  log: Logger,
): Promise<void> {
  const { userId, email, ip, userAgent, alertType, scheduledAt } = data;

  const revokeUrl = `${env.API_BASE_URL}/api/v1/sessions`;

  log.info({ userId, alertType }, "Sending security alert email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: SUBJECTS[alertType],
    react: SecurityAlertEmail({
      alertType,
      recipientEmail: email,
      ip,
      userAgent,
      revokeUrl,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    }),
  });

  if (error) {
    log.error(
      { userId, alertType, error },
      "Resend failed: send-security-alert",
    );
    throwResendError(error, {
      userId,
      email,
      alertType,
      jobName: "send-security-alert",
    });
  }

  log.warn({ userId, alertType }, "Security alert email sent");
}
