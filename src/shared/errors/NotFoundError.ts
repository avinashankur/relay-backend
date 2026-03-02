import { AppError } from "./AppError";

/**
 * 404 Not Found — requested resource does not exist.
 *
 * Use for:
 *   - User, session, or audit record not found by ID
 *   - Route not matched (via not-found middleware)
 */

export class NotFoundError extends AppError {
  constructor(code: NotFoundErrorCode, message: string) {
    super(404, code, message);
  }
}

export type NotFoundErrorCode =
  | "USER_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "AUDIT_EVENT_NOT_FOUND"
  | "ROUTE_NOT_FOUND";
