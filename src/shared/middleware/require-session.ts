import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@/generated/prisma/client";
import { AuthError } from "@/shared/errors/AuthError";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";

/**
 * Validates that the session referenced by the access token still exists in
 * the database and belongs to an active (non-suspended, non-deleted) user.
 *
 * This closes the window between session revocation and access-token expiry:
 * without this check, a revoked session's access token remains valid for up
 * to the 15-minute JWT TTL after the session row is deleted.
 *
 * **Placement**: must run after `parseToken` and `requireAuth` in the chain.
 *
 * **Cost**: one DB read per protected request. Apply selectively to routes
 * where session freshness guarantees outweigh the extra latency (e.g. admin
 * routes, account management, session revocation itself).
 *
 * See TODO.md [SEC-04].
 */
export function requireSession(prisma: PrismaClient) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // requireAuth must run first — req.user is guaranteed non-null here.
    const user = req.user!;

    try {
      const session = await prisma.session.findUnique({
        where: { id: user.sessionId },
        select: {
          id: true,
          expiresAt: true,
          user: {
            select: {
              deletedAt: true,
              suspended: true,
            },
          },
        },
      });

      if (!session) {
        return next(
          new AuthError("SESSION_REVOKED", "Session has been revoked"),
        );
      }

      if (new Date() > session.expiresAt) {
        return next(new AuthError("TOKEN_EXPIRED", "Session has expired"));
      }

      if (session.user.deletedAt) {
        return next(
          new AuthError("ACCOUNT_DELETED", "This account has been deleted"),
        );
      }

      if (session.user.suspended) {
        return next(
          new ForbiddenError(
            "ACCOUNT_SUSPENDED",
            "This account has been suspended",
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
