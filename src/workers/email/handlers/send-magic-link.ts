import { env } from "@/config/env";
import { Resend } from "resend";
import type { Logger } from "pino";
import { MagicLinkEmail } from "@/emails/MagicLinkEmail";
import type { SendMagicLinkJobData } from "../email.queue";
import { throwResendError } from "./resend-error";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendMagicLink(
  data: SendMagicLinkJobData,
  log: Logger,
): Promise<void> {
  const { email, token } = data;

  const magicLinkUrl = `${env.API_BASE_URL}/api/v1/auth/magic-link/callback?token=${token}`;

  log.info("Sending magic link email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your sign-in link",
    react: MagicLinkEmail({ magicLinkUrl, recipientEmail: email }),
  });

  if (error) {
    log.error({ error }, "Resend failed: send-magic-link");
    throwResendError(error, { email, jobName: "send-magic-link" });
  }

  log.info("Magic link email sent");
}
