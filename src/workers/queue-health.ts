/**
 * Queue health utilities.
 *
 * Provides a lightweight snapshot of a BullMQ Queue's job-count breakdown
 * (waiting, active, delayed, failed) and a periodic logger that emits the
 * snapshot on a fixed interval so operators can spot queue growth, stuck
 * active jobs, or dead-letter accumulation without tailing raw BullMQ events.
 */
import type { Queue } from "bullmq";
import { logger } from "@/config/logger";

// Types

export interface QueueHealthSnapshot {
  queueName: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  /** True if the queue has accumulated failed jobs above the warning threshold. */
  failedExceedsThreshold: boolean;
  /** True if there are more active jobs than the concurrency ceiling suggests. */
  activeExceedsThreshold: boolean;
  capturedAt: string; // ISO timestamp
}

export interface QueueHealthConfig {
  /**
   * Log a warning when the failed job count exceeds this many jobs.
   * Default: 50 (signals the dead-letter set is accumulating).
   */
  failedWarnThreshold?: number;
  /**
   * Log a warning when the active job count exceeds this many jobs.
   * Useful to detect stuck-job pile-ups when the worker pool is saturated.
   * Default: 20.
   */
  activeWarnThreshold?: number;
}

// Core snapshot function

/**
 * Returns a single health snapshot for the given BullMQ Queue.
 * All four job-count calls are made in parallel to minimise latency.
 *
 * @throws If any of the underlying BullMQ Redis calls fail; callers should
 *         catch and log rather than letting it crash the worker.
 */
export async function snapshotQueue(
  queue: Queue,
  config: QueueHealthConfig = {},
): Promise<QueueHealthSnapshot> {
  const { failedWarnThreshold = 50, activeWarnThreshold = 20 } = config;

  const [waiting, active, delayed, failed, completed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getFailedCount(),
    queue.getCompletedCount(),
  ]);

  return {
    queueName: queue.name,
    waiting,
    active,
    delayed,
    failed,
    completed,
    failedExceedsThreshold: failed > failedWarnThreshold,
    activeExceedsThreshold: active > activeWarnThreshold,
    capturedAt: new Date().toISOString(),
  };
}

// Periodic health logger

/**
 * Starts a recurring interval that logs a structured queue-health snapshot for
 * each queue in `queues`.
 *
 * The emitted log line uses `logger.info` normally, and escalates to
 * `logger.warn` when any threshold is exceeded so CloudWatch / ELK alert rules
 * can trigger on `level:"warn"` without custom filters.
 *
 * @returns A cleanup function that clears the interval — call it during
 *          graceful shutdown before closing the queues.
 */
export function startQueueHealthLogger(
  queues: Queue[],
  intervalMs: number,
  config: QueueHealthConfig = {},
): () => void {
  const timer = setInterval(async () => {
    for (const queue of queues) {
      try {
        const snapshot = await snapshotQueue(queue, config);

        const isUnhealthy =
          snapshot.failedExceedsThreshold || snapshot.activeExceedsThreshold;

        const logFn = isUnhealthy
          ? logger.warn.bind(logger)
          : logger.info.bind(logger);

        logFn(
          {
            event: "queue.health",
            queue: snapshot.queueName,
            waiting: snapshot.waiting,
            active: snapshot.active,
            delayed: snapshot.delayed,
            failed: snapshot.failed,
            completed: snapshot.completed,
            failedExceedsThreshold: snapshot.failedExceedsThreshold,
            activeExceedsThreshold: snapshot.activeExceedsThreshold,
          },
          isUnhealthy
            ? `Queue health check — ${snapshot.queueName}: threshold exceeded`
            : `Queue health check — ${snapshot.queueName}`,
        );
      } catch (err) {
        // Never let a health-check failure crash the process — log and continue.
        logger.error(
          { err, queue: queue.name },
          "Queue health snapshot failed",
        );
      }
    }
  }, intervalMs);

  // unref() so the timer does not keep the Node.js event loop alive if all
  // other work is done — the shutdown sequence in worker.ts is responsible for
  // orderly teardown.
  timer.unref();

  return () => clearInterval(timer);
}
