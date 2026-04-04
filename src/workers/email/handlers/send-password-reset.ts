import { env } from "@/config/env";
import { Resend } from "resend";
import { logger } from "@/config/logger";
import PasswordResetEmail from "@/emails/PasswordResetEmail";
import type { SendPasswordResetJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendPasswordReset(
  data: SendPasswordResetJobData,
): Promise<void> {
  const { userId, email, token } = data;

  const resetUrl = `${env.API_BASE_URL}/api/v1/auth/password/reset?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    react: PasswordResetEmail({ resetUrl }),
  });

  if (error) {
    logger.error(
      { userId, email, error },
      "Resend failed: send-password-reset",
    );
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ userId, email }, "Password reset email sent");
}
