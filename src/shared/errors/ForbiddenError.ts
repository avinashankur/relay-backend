import { AppError } from "./AppError";

/**
 * 403 Forbidden — authenticated but not authorized.
 *
 * Use for:
 *   - Insufficient role (e.g. USER accessing admin routes)
 *   - Attempting to modify another user's resource
 *   - CSRF token validation failure
 */
export class ForbiddenError extends AppError {
  constructor(code: ForbiddenErrorCode, message: string) {
    super(403, code, message);
  }
}

export type ForbiddenErrorCode =
  | "INSUFFICIENT_ROLE" // role check failed (requireRole middleware)
  | "RESOURCE_FORBIDDEN" // authenticated user does not own the resource
  | "CSRF_INVALID" // double-submit CSRF token mismatch
  | "ADMIN_SELF_DELETE_FORBIDDEN"; // admin can not delete self account
