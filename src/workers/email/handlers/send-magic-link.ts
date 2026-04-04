import { env } from "@/config/env";
import { Resend } from "resend";
import { logger } from "@/config/logger";
import { MagicLinkEmail } from "@/emails/MagicLinkEmail";
import type { SendMagicLinkJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendMagicLink(data: SendMagicLinkJobData): Promise<void> {
  const { email, token } = data;

  const magicLinkUrl = `${env.API_BASE_URL}/api/v1/auth/magic-link/callback?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your sign-in link",
    react: MagicLinkEmail({ magicLinkUrl }),
  });

  if (error) {
    logger.error({ email, error }, "Resend failed: send-magic-link");
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ email }, "Magic link email sent");
}
