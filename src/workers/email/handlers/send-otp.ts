import { env } from "@/config/env";
import { Resend } from "resend";
import { OtpEmail } from "@/emails/OtpEmail";
import { logger } from "@/config/logger";
import type { SendOtpJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);
export async function sendOtp(data: SendOtpJobData): Promise<void> {
  const { email, code } = data;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your verification code",
    react: OtpEmail({ code }),
  });

  if (error) {
    logger.error({ email, error }, "Resend failed: send-otp");
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ email }, "OTP email sent");
}
