import { env } from "@/config/env";
import { Resend } from "resend";
import { logger } from "@/config/logger";
import SecurityAlertEmail from "@/emails/SecurityAlertEmail";
import type { SendSecurityAlertJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);

const SUBJECTS: Record<SendSecurityAlertJobData["alertType"], string> = {
  token_reuse: "Security alert: suspicious session activity detected",
  suspicious_login: "Security alert: new sign-in to your account",
  password_changed: "Your password has been changed",
};

export async function sendSecurityAlert(
  data: SendSecurityAlertJobData,
): Promise<void> {
  const { userId, email, ip, userAgent, alertType } = data;

  const revokeUrl = `${env.API_BASE_URL}/api/v1/sessions`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: SUBJECTS[alertType],
    react: SecurityAlertEmail({ alertType, ip, userAgent, revokeUrl }),
  });

  if (error) {
    logger.error(
      { userId, email, alertType, error },
      "Resend failed: send-security-alert",
    );
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.warn({ userId, email, alertType }, "Security alert email sent");
}
