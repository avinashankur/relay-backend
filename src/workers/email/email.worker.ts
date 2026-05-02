import { Job, UnrecoverableError, Worker } from "bullmq";
import { redisConnection } from "@/config/redis";
import { logger } from "@/config/logger";
import * as Sentry from "@sentry/node";

import {
  EMAIL_QUEUE_NAME,
  EmailJobName,
  type SendDemoJobData,
  type SendMagicLinkJobData,
  type SendOtpJobData,
  type SendPasswordResetJobData,
  type SendSecurityAlertJobData,
  type SendVerificationJobData,
} from "./email.queue";

import { sendVerification } from "./handlers/send-verification";
import { sendMagicLink } from "./handlers/send-magic-link";
import { sendOtp } from "./handlers/send-otp";
import { sendPasswordReset } from "./handlers/send-password-reset";
import { sendSecurityAlert } from "./handlers/send-security-alert";
import { sendDemoEmail } from "./handlers/send-demo-email";

async function processEmailJob(job: Job): Promise<void> {
  logger.info({ jobId: job.id, jobName: job.name }, "Processing email job");

  switch (job.name) {
    case EmailJobName.SendVerification:
      await sendVerification(job.data as SendVerificationJobData);
      break;

    case EmailJobName.SendMagicLink:
      await sendMagicLink(job.data as SendMagicLinkJobData);
      break;

    case EmailJobName.SendOtp:
      await sendOtp(job.data as SendOtpJobData);
      break;

    case EmailJobName.SendPasswordReset:
      await sendPasswordReset(job.data as SendPasswordResetJobData);
      break;

    case EmailJobName.SendSecurityAlert:
      await sendSecurityAlert(job.data as SendSecurityAlertJobData);
      break;

    case EmailJobName.SendDemo:
      await sendDemoEmail(job.data as SendDemoJobData);
      break;

    default:
      throw new UnrecoverableError(`Unknown email job name: ${job.name}`);
  }

  logger.info({ jobId: job.id, jobName: job.name }, "Email job completed");
}

export const emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: 10, // process up to 10 email jobs in parallel
});

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "Email job succeeded");
});

emailWorker.on("failed", (job, err) => {
  const isFinal = job && job.attemptsMade >= (job.opts.attempts ?? 3);

  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      isFinal,
      err,
    },
    "Email job failed",
  );

  // Report to Sentry on final failure (landed in DLQ)
  if (isFinal) {
    Sentry.withScope((scope) => {
      scope.setTag("queue", EMAIL_QUEUE_NAME);
      scope.setTag("jobName", job?.name);
      scope.setContext("job", {
        id: job?.id,
        name: job?.name,
        data: job?.data,
        attemptsMade: job?.attemptsMade,
      });

      Sentry.captureException(err);
    });
  }

  emailWorker.on("error", (err) => {
    logger.error({ err }, "Email worker connection error");
  });
});

// Graceful shutdown
export async function shutdownEmailWorker(): Promise<void> {
  logger.info("Shutting down email worker...");
  await emailWorker.close();
  logger.info("Email worker shut down");
}
