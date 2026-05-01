/**
 * Middleware barrel — import all auth/authz middleware from here.
 *
 * Usage:
 *   import { parseToken, requireAuth, requireRole, requireSession } from "@/shared/middleware";
 */
export { parseToken } from "./parse-token";
export { requireAuth } from "./require-auth";
export { requireRole } from "./require-role";
export { requireSession } from "./require-session";
export { errorHandler } from "./error-handler";
export { createRateLimit } from "./rate-limit";
