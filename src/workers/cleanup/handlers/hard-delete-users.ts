import { PrismaClient } from "@/generated/prisma/client";
import { jobLogger } from "@/config/logger";
import { AuditService } from "@/shared/services/audit.service";

const HARD_DELETE_AFTER_DAYS = 30;

export async function hardDeleteUsers(
  prisma: PrismaClient,
  auditService: AuditService,
  jobId?: string,
): Promise<void> {
  const log = jobLogger({
    jobId,
    queue: "cleanup",
    jobName: "hard-delete-users",
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HARD_DELETE_AFTER_DAYS);

  // fetch first so you can audit before deletion
  const users = await prisma.user.findMany({
    where: {
      deletedAt: { lt: cutoff },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (users.length === 0) return;

  const userIds = users.map((u) => u.id);

  const { count } = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  await Promise.all(
    userIds.map((userId) =>
      auditService.log({
        action: "user.hard_deleted",
        metadata: { deletedUserId: userId, triggeredBy: "cleanup-worker" },
      }),
    ),
  );

  log.info({ count }, "Hard delete complete");
}
