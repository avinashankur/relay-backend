import { env } from "@/config/env";
import type { Logger } from "pino";
import DemoEmail from "@/emails/DemoEmail";
import { Resend } from "resend";
import type { SendDemoJobData } from "../email.queue";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendDemoEmail(
  data: SendDemoJobData,
  log: Logger,
): Promise<void> {
  const { email } = data;

  log.info("Sending demo email");

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "[TEST] Demo email from Relay",
    react: DemoEmail({ recipientEmail: email }),
  });

  if (error) {
    log.error({ error }, "Resend failed: send-demo-email");
    throw new Error(`Resend error: ${error.message}`);
  }

  log.info("Demo email sent");
}
