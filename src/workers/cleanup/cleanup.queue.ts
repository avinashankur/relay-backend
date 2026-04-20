import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export const CLEANUP_JOBS = {
  EXPIRE_SESSIONS: "expire-sessions",
  HARD_DELETE_USERS: "hard-delete-users",
} as const;

export type CleanupJobName = (typeof CLEANUP_JOBS)[keyof typeof CLEANUP_JOBS];

export function createCleanupQueue(connection: Redis): Queue {
  const queue = new Queue("cleanup", { connection });

  // Runs daily at 02:00 UTC
  queue.add(
    CLEANUP_JOBS.EXPIRE_SESSIONS,
    {},
    {
      repeat: { pattern: "0 2 * * *" },
      jobId: "expire-sessions-cron", // stable ID prevents duplicate cron registration
    },
  );

  queue.add(
    CLEANUP_JOBS.HARD_DELETE_USERS,
    {},
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "hard-delete-users-cron",
    },
  );

  return queue;
}
