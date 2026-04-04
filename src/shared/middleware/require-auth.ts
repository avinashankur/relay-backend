import type { Request, Response, NextFunction } from "express";
import { AuthError } from "../errors/AuthError";

/**
 * Rejects the request with 401 if req.user is not populated.
 * Must be used after parseToken in the middleware chain.
 */

interface AuthenticatedRequest extends Request {
  user?: unknown;
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    return next(new AuthError("MISSING_TOKENS", "Authentication required"));
  }
  next();
}
