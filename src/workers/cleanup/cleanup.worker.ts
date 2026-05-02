import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@/generated/prisma/client";
import { AuditService } from "@/shared/services/audit.service";
import { jobLogger, logger } from "@/config/logger";
import { CLEANUP_JOBS, type CleanupJobName } from "./cleanup.queue";
import { expireSessions } from "./handlers/expire-sessions";
import { hardDeleteUsers } from "./handlers/hard-delete-users";

export function createCleanupWorker(
  prisma: PrismaClient,
  auditService: AuditService,
  connection: Redis,
): Worker {
  const worker = new Worker(
    "cleanup",
    async (job: Job) => {
      const log = jobLogger({
        jobId: job.id,
        queue: "cleanup",
        jobName: job.name,
      });

      log.info("Job started");

      switch (job.name as CleanupJobName) {
        case CLEANUP_JOBS.EXPIRE_SESSIONS:
          await expireSessions(prisma, job.id);
          break;
        case CLEANUP_JOBS.HARD_DELETE_USERS:
          await hardDeleteUsers(prisma, auditService, job.id);
          break;
        default:
          throw new Error(`Unknown cleanup job: ${job.name}`);
      }

      log.info("Job completed");
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    jobLogger({
      jobId: job?.id,
      queue: "cleanup",
      jobName: job?.name ?? "unknown",
    }).error({ err }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Cleanup worker connection error");
  });

  return worker;
}

/**
 * Gracefully drain the cleanup worker and close its BullMQ connection.
 * Waits for any currently-executing job to finish before closing.
 */
export async function shutdownCleanupWorker(worker: Worker): Promise<void> {
  logger.info("Shutting down cleanup worker...");
  await worker.close();
  logger.info("Cleanup worker shut down");
}
