import { AppError } from "./AppError";

/**
 * 401 Unauthorized — authentication is required or has failed.
 *
 * Use for:
 *   - Invalid or expired credentials (password, token, OTP)
 *   - Missing or malformed JWT / refresh token
 *   - Token reuse detected
 *   - Account deleted or suspended at the auth boundary
 */

export class AuthError extends AppError {
  constructor(code: AuthErrorCode, message: string) {
    super(401, code, message);
  }
}

export type AuthErrorCode =
  | "INVALID_CREDENTIALS" // wrong email/password, wrong OTP code
  | "EMAIL_NOT_VERIFIED" // login attempted before verifying email
  | "INVALID_TOKEN" // magic link / reset / verify token missing or expired
  | "TOKEN_EXPIRED" // JWT or refresh token past its TTL
  | "TOKEN_REUSE_DETECTED" // refresh token presented after already being rotated
  | "MISSING_REFRESH_TOKEN" // refresh endpoint called with no cookie
  | "MISSING_ACCESS_TOKEN" // protected route hit with no JWT cookie
  | "SESSION_REVOKED" // session explicitly revoked by user or admin
  | "ACCOUNT_DELETED" // user soft-deleted
  | "ACCOUNT_SUSPENDED" // user suspended by admin
  | "OTP_LOCKED" // max OTP attempts exceeded; requires re-request
  | "OAUTH_STATE_MISMATCH"; // OAuth state param does not match stored value
