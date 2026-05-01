import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/shared/errors/AppError";

/**
 * Rejects requests whose `Content-Type` is not `application/json`.
 *
 * Why this matters for CSRF:
 *   Auth cookies in this API are `HttpOnly` and `SameSite=Strict` (production).
 *   `SameSite=Strict` is the primary CSRF defence — the browser will not
 *   attach cookies to cross-origin requests at all.
 *
 *   An additional defence-in-depth layer: a malicious page using a plain
 *   HTML <form> or a simple `fetch` cannot set `Content-Type: application/json`
 *   for cross-origin requests without triggering a CORS preflight that the
 *   server can reject. Enforcing this header on every state-mutating endpoint
 *   closes the residual vector for browsers or clients that do not honour
 *   SameSite correctly.
 *
 *   This middleware does NOT implement a CSRF token / double-submit pattern.
 *   That pattern would require serving a synchroniser token to the client,
 *   which is unnecessary complexity given the HttpOnly + SameSite=Strict posture.
 *
 * Apply to: POST/PATCH/DELETE auth endpoints that mutate state.
 * Do NOT apply to: GET endpoints or multipart/form-data uploads.
 *
 * See TODO.md [SEC-05].
 */
export function requireJsonBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const contentType = req.headers["content-type"] ?? "";

  if (!contentType.includes("application/json")) {
    return next(
      new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Content-Type must be application/json",
      ),
    );
  }

  next();
}
