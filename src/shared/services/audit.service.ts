import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { RedisService } from "./redis.service";
import { logger } from "@/config/logger";

// Types
export interface AuditEventInput {
  action: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

interface StoredAuditEvent extends AuditEventInput {
  createdAt: string; // ISO timestamp -- serialised to string for Redis
}

// Constants
// Why flush threshold and buffer TTL?
// Later (every 30 seconds or when there are 100+ events), the flush() method clear the buffer and and writes them to the auditEvent table in Prisma/PostgreSQL
const BUFFER_KEY = "audit:buffer";
const FLUSH_THRESHOLD = 100; // flush when buffer reaches this many events (audit events)
const BUFFER_TTL = 300; // safety net TTL on Redis list key

// Service
/**
 * Writes audit events to Postgres via a Redis list buffer.
 *
 * Normal flow:
 *   log() → rPush to Redis list → worker flushes every 30s (or at FLUSH_THRESHOLD)
 *
 * Resilience layers:
 *   1. Redis unavailable  → falls back to direct DB write
 *   2. DB write fails     → logs to stdout (CloudWatch / ELK picks it up)
 *   3. Critical events    → logCritical() bypasses the buffer entirely
 */
export class AuditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Append an audit event to the Redis buffer.
   * Non-blocking -- callers do not need to await the result.
   * Falls back to a direct DB write if Redis is unavailable.
   */
  async log(event: AuditEventInput): Promise<void> {
    try {
      const payload: StoredAuditEvent = {
        ...event,
        createdAt: new Date().toISOString(),
      };

      const listLen = await this.redisService.rPush(
        BUFFER_KEY,
        JSON.stringify(payload),
      );

      // Refresh the TTL on every push so the key doesn't expire mid-buffer
      await this.redisService.expire(BUFFER_KEY, BUFFER_TTL);

      // Eagerly flush if buffer is getting large -- fire-and-forget
      if (listLen >= FLUSH_THRESHOLD) {
        this.flush().catch((err) =>
          logger.error({ err }, "AuditService: eager flush failed"),
        );
      }
    } catch (err) {
      logger.warn(
        { err },
        "AuditService: Redis unavailable -- writing directly to DB",
      );
      await this.writeToDb(event);
    }
  }

  /**
   * Write a critical audit event directly to the DB, bypassing the buffer.
   * Use for events that must never be lost (e.g. auth.token_reuse).
   */
  async logCritical(event: AuditEventInput): Promise<void> {
    await this.writeToDb(event);
  }

  /**
   * Flush buffered events from Redis into the database.
   * Called by the cleanup worker on a schedule or when the buffer is full.
   * Returns the number of events written.
   */
  async flush(): Promise<number> {
    const result = await this.redisService.lmPop(BUFFER_KEY, FLUSH_THRESHOLD);
    if (!result || result.elements.length === 0) return 0;

    const rows: Prisma.AuditEventCreateManyInput[] = result.elements.map(
      (raw) => {
        const { createdAt, metadata, ...rest } = JSON.parse(
          raw,
        ) as StoredAuditEvent;
        return {
          ...rest,
          createdAt: new Date(createdAt),
          // Prisma Json? fields require InputJsonValue — cast via unknown
          ...(metadata !== undefined && {
            metadata: metadata as unknown as Prisma.InputJsonValue,
          }),
        };
      },
    );

    await this.prisma.auditEvent.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return rows.length;
  }

  private async writeToDb(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: event as Prisma.AuditEventCreateInput,
      });
    } catch (err) {
      // Last resort -- log to stdout so CloudWatch / ELK captures it
      logger.error(
        { err, event },
        "AuditService: failed to write audit event to DB",
      );
    }
  }
}
