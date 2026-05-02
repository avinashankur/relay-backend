import { env } from "@/config/env";
import { logger } from "@/config/logger";
import DemoEmail from "@/emails/DemoEmail";
import { Resend } from "resend";
import type { SendDemoJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendDemoEmail(data: SendDemoJobData): Promise<void> {
  const { email } = data;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "[TEST] Demo email from Relay",
    react: DemoEmail({ recipientEmail: email }),
  });

  if (error) {
    logger.error({ email, error }, "Resend failed: send-demo-email");
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ email }, "Demo email sent");
}
