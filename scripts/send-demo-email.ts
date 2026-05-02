/**
 * Send a demo/test email via the BullMQ email pipeline.
 *
 * Usage:
 *   npm run script:send-demo-email -- you@example.com
 *
 * The job is picked up by the running email worker. Make sure
 * the worker (npm run dev) and Redis are both running before
 * executing this script.
 */
import "dotenv/config"; // must be first — env.ts validates at import time
import { emailService } from "../src/shared/services/email.service";

const recipient = process.argv[2];

if (!recipient || !recipient.includes("@")) {
  console.error("Usage: npm run script:send-demo-email -- <email>");
  process.exit(1);
}

console.log(`Enqueueing demo email to ${recipient}...`);

const jobId = await emailService.sendDemoEmail({ email: recipient });

console.log(
  `✓ Job enqueued (id: ${jobId}). The worker will deliver it shortly.`,
);

process.exit(0);
