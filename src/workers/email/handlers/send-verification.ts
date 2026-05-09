import { Resend } from "resend";
import { env } from "@/config/env";
import type { Logger } from "pino";
import type { SendVerificationJobData } from "../email.queue";
import SignupVerificationEmail from "@/emails/SignupVerificationEmail";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerification(
  data: SendVerificationJobData,
  log: Logger,
): Promise<void> {
  const { userId, email, token } = data;

  const verificationUrl = `${env.API_BASE_URL}/api/v1/auth/verify-email?token=${token}`;

  log.info({ userId }, "Sending verification email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    react: SignupVerificationEmail({ verificationUrl, recipientEmail: email }),
  });

  if (error) {
    log.error({ userId, error }, "Resend failed: send-verification");
    throwResendError(error, { userId, email, jobName: "send-verification" });
  }

  log.info({ userId }, "Verification email sent");
}
