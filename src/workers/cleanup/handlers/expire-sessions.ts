import { PrismaClient } from "@/generated/prisma/client";
import { jobLogger } from "@/config/logger";

export async function expireSessions(
  prisma: PrismaClient,
  jobId?: string,
): Promise<void> {
  const log = jobLogger({
    jobId,
    queue: "cleanup",
    jobName: "expire-sessions",
  });

  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  log.info({ count }, "Expired session cleanup complete");
}
