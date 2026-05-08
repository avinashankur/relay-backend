import { Resend } from "resend";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import type { SendVerificationJobData } from "../email.queue";
import SignupVerificationEmail from "@/emails/SignupVerificationEmail";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerification(
  data: SendVerificationJobData,
): Promise<void> {
  const { userId, email, token } = data;

  const verificationUrl = `${env.API_BASE_URL}/api/v1/auth/verify-email?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    react: SignupVerificationEmail({ verificationUrl, recipientEmail: email }),
  });

  if (error) {
    logger.error(
      { userId, email, error },
      "Resend failed to send verification email",
    );
    throwResendError(error, { userId, email, jobName: "send-verification" });
  }

  logger.info({ userId, email }, "Verification email sent");
}
