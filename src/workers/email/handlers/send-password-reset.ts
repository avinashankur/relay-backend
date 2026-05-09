import { env } from "@/config/env";
import { Resend } from "resend";
import type { Logger } from "pino";
import PasswordResetEmail from "@/emails/PasswordResetEmail";
import type { SendPasswordResetJobData } from "../email.queue";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendPasswordReset(
  data: SendPasswordResetJobData,
  log: Logger,
): Promise<void> {
  const { userId, email, token } = data;

  const resetUrl = `${env.API_BASE_URL}/api/v1/auth/password-reset?token=${token}`;

  log.info({ userId }, "Sending password reset email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    react: PasswordResetEmail({ resetUrl, recipientEmail: email }),
  });

  if (error) {
    log.error({ userId, error }, "Resend failed: send-password-reset");
    throwResendError(error, { userId, email, jobName: "send-password-reset" });
  }

  log.info({ userId }, "Password reset email sent");
}
