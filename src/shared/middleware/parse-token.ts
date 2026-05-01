import type { Request, Response, NextFunction } from "express";
import { JwtService } from "@/shared/services/jwt.service";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Extracts and verifies the access token from either:
 *   1. The `access_token` HTTP-only cookie (browser clients), or
 *   2. The `Authorization: Bearer <token>` header (API / non-browser clients).
 *
 * On success, populates `req.user` with the verified claims.
 * On failure (missing, expired, or malformed token), calls `next()` without
 * populating `req.user` — authentication enforcement is the responsibility of
 * `requireAuth`.
 *
 * See TODO.md [SEC-04].
 */
export function parseToken(jwtService: JwtService) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = extractToken(req);

      if (!token) {
        return next();
      }

      const payload = await jwtService.verify(token);
      req.user = {
        id: payload.sub,
        role: payload.role as UserRole,
        sessionId: payload.sessionId,
      };
    } catch {
      // Invalid/expired token — don't throw, just don't populate req.user.
      // requireAuth middleware will enforce the 401 if the route needs it.
    }

    next();
  };
}

/**
 * Resolves the raw token string from the request.
 * Cookie takes precedence over the Authorization header so that browser
 * session cookies are not accidentally shadowed by a stale header.
 */
function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.access_token as string | undefined;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || undefined;
  }

  return undefined;
}
