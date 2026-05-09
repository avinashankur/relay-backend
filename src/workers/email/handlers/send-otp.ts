import { env } from "@/config/env";
import { Resend } from "resend";
import type { Logger } from "pino";
import { OtpEmail } from "@/emails/OtpEmail";
import type { SendOtpJobData } from "../email.queue";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOtp(
  data: SendOtpJobData,
  log: Logger,
): Promise<void> {
  const { email, code } = data;

  log.info("Sending OTP email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your verification code",
    react: OtpEmail({ code, recipientEmail: email }),
  });

  if (error) {
    log.error({ error }, "Resend failed: send-otp");
    throwResendError(error, { email, jobName: "send-otp" });
  }

  log.info("OTP email sent");
}
