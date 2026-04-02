import { Resend } from "resend";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import type { SendVerificationJobData } from "../email.queue";
import SignupVerificationEmail from "@/emails/SignupVerificationEmail";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerification(
  data: SendVerificationJobData,
): Promise<void> {
  const { userId, email, token } = data;

  const verificationUrl = `${env.API_BASE_URL}/auth/email/verify?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    react: SignupVerificationEmail({ verificationUrl }),
  });

  if (error) {
    logger.error(
      { userId, email, error },
      "Resend failed to send verification email",
    );
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ userId, email }, "Verification email sent");
}
