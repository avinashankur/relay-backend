/**
 * Email BullMQ worker.
 *
 * Reliability contract (See TODO.md [EMAIL-04]):
 *
 *  Backoff strategy
 *    Custom exponential + jitter: delay = base * 2^(attempt-1) * jitterFactor
 *    where jitterFactor ∈ [1.0, 1.4] (full jitter in 0–40 % band).
 *    Standard jobs: up to 4 attempts (~30 s window).
 *    Critical jobs: up to 6 attempts (~2 min window).
 *
 *  Dead-letter handling
 *    BullMQ does not have a native DLQ queue. Exhausted jobs are retained in
 *    the failed set (last 1 000 per EMAIL_JOB_OPTIONS_DEFAULT). Operators can
 *    inspect and replay them via Bull Board or `queue.retryJobs()`.
 *
 *  Alerting
 *    Transient failure (retryable): structured error log with attempt count.
 *    Final failure (all attempts exhausted): Sentry exception + logger.fatal.
 *    Stalled job (lock timeout): logger.error + Sentry message.
 *    Worker-level connection error: logger.error (does not kill the process).
 *
 * Operational observability (See TODO.md [EMAIL-05]):
 *
 *  Handler-level logging
 *    Each job gets a child logger bound with { jobId, queue, jobName, attempt }
 *    that is threaded into the handler. Every log line from a handler therefore
 *    carries those correlation IDs automatically — no spelunking required.
 */
import { Job, UnrecoverableError, Worker } from "bullmq";
import { redisConnection } from "@/config/redis";
import { jobLogger, logger } from "@/config/logger";
import * as Sentry from "@sentry/node";

import {
  EMAIL_BACKOFF_BASE_MS,
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

// ── Custom backoff strategy ───────────────────────────────────────────────────
// BullMQ calls this function when a job fails and needs to be rescheduled.
// Returns the number of milliseconds to wait before the next attempt.
//
// Formula: base * 2^(attemptsMade - 1) * jitterFactor
//   jitterFactor is a uniform random in [1.0, 1.4] (full-jitter band).
//
// Example delays (base = 2 s, no jitter):
//   attempt 1 → 2 s, 2 → 4 s, 3 → 8 s, 4 → 16 s, 5 → 32 s, 6 → 64 s
//
// The jitter spreads retries across the cluster so a single Resend API
// rate-limit burst does not cause all workers to retry in lockstep.
function emailBackoffStrategy(attemptsMade: number): number {
  const exponential = EMAIL_BACKOFF_BASE_MS * Math.pow(2, attemptsMade - 1);
  const jitterFactor = 1 + Math.random() * 0.4; // [1.0, 1.4]
  return Math.round(exponential * jitterFactor);
}

// ── Job processor ─────────────────────────────────────────────────────────────
async function processEmailJob(job: Job): Promise<void> {
  // Build a per-job child logger so every log line emitted by this function
  // AND by the handler it dispatches to automatically carries jobId, queue,
  // jobName, and the current attempt number as structured fields.
  // See TODO.md [EMAIL-05].
  const log = jobLogger({
    jobId: job.id,
    queue: EMAIL_QUEUE_NAME,
    jobName: job.name,
    attempt: job.attemptsMade + 1,
  });

  log.info("Email job started");

  switch (job.name) {
    case EmailJobName.SendVerification:
      await sendVerification(job.data as SendVerificationJobData, log);
      break;

    case EmailJobName.SendMagicLink:
      await sendMagicLink(job.data as SendMagicLinkJobData, log);
      break;

    case EmailJobName.SendOtp:
      await sendOtp(job.data as SendOtpJobData, log);
      break;

    case EmailJobName.SendPasswordReset:
      await sendPasswordReset(job.data as SendPasswordResetJobData, log);
      break;

    case EmailJobName.SendSecurityAlert:
      await sendSecurityAlert(job.data as SendSecurityAlertJobData, log);
      break;

    case EmailJobName.SendDemo:
      await sendDemoEmail(job.data as SendDemoJobData, log);
      break;

    default:
      // Unknown job names are not retryable — fail immediately.
      throw new UnrecoverableError(`Unknown email job name: ${job.name}`);
  }

  log.info("Email job completed");
}

// ── Worker ────────────────────────────────────────────────────────────────────
export const emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: 10, // process up to 10 email jobs in parallel

  // Custom backoff strategy referenced by EMAIL_JOB_OPTIONS_DEFAULT
  // (backoff.type: "custom"). See email.queue.ts.
  settings: {
    backoffStrategy: emailBackoffStrategy,
  },

  // stalledInterval: how often (ms) the worker checks for stalled jobs
  // (jobs whose lock expired while processing).
  stalledInterval: 30_000, // 30 s

  // lockDuration: how long (ms) a job lock is held before it is considered
  // stalled. Set longer than the worst-case Resend API call duration.
  lockDuration: 60_000, // 60 s
});

// ── Worker event listeners ────────────────────────────────────────────────────
// NOTE: all listeners are attached here at construction time, not inside other
// event callbacks. Attaching listeners inside a "failed" handler is a bug —
// it would re-register on every failure.

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "Email job succeeded");
});

emailWorker.on("failed", (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 4;
  const attemptsMade = job?.attemptsMade ?? 0;
  const isFinal = attemptsMade >= maxAttempts;

  if (isFinal) {
    // All retries exhausted — job has entered the failed (dead-letter) set.
    // Alert via Sentry at fatal severity so on-call is paged.
    logger.fatal(
      {
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade,
        maxAttempts,
        err,
      },
      "Email job permanently failed — all retries exhausted",
    );

    Sentry.withScope((scope) => {
      scope.setLevel("fatal");
      scope.setTag("queue", EMAIL_QUEUE_NAME);
      scope.setTag("jobName", job?.name ?? "unknown");
      scope.setContext("job", {
        id: job?.id,
        name: job?.name,
        data: job?.data,
        attemptsMade,
        maxAttempts,
      });
      Sentry.captureException(err);
    });
  } else {
    // Transient failure — job will be retried. Log as error so it appears
    // in dashboards but does not page on-call until the final attempt.
    logger.error(
      {
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade,
        maxAttempts,
        err,
      },
      "Email job failed — will retry",
    );
  }
});

emailWorker.on("stalled", (jobId) => {
  // A stalled job had its lock expire before the processor returned. BullMQ
  // will re-queue it automatically, but repeated stalls may indicate the
  // processor is hanging (e.g. Resend response never arrives).
  logger.error({ jobId }, "Email job stalled — lock expired, re-queuing");
  Sentry.captureMessage(`Email job stalled: ${jobId}`, "warning");
});

emailWorker.on("error", (err) => {
  // Worker-level connection error (not a job failure). The worker will attempt
  // to reconnect automatically. Log and alert, but do not exit.
  logger.error({ err }, "Email worker connection error");
  Sentry.captureException(err);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
export async function shutdownEmailWorker(): Promise<void> {
  logger.info("Shutting down email worker...");
  await emailWorker.close();
  logger.info("Email worker shut down");
}
