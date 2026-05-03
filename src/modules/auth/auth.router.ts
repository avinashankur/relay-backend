import { Router } from "express";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { SessionService } from "../sessions/sessions.service";
import { RedisService } from "@/shared/services/redis.service";
import {
  createRateLimit,
  parseToken,
  requireJsonBody,
} from "@/shared/middleware";
import { JwtService } from "@/shared/services/jwt.service";

/**
 * CSRF posture for this router:
 *   Cookies are HttpOnly + SameSite=Strict (production).
 *   SameSite=Strict prevents cross-origin cookie attachment entirely.
 *   `requireJsonBody` adds a defence-in-depth layer: cross-origin form
 *   submissions and simple fetches cannot set Content-Type: application/json,
 *   so any request missing that header is rejected before reaching the handler.
 *   A CSRF token / double-submit pattern is not required under this posture.
 *   See TODO.md [SEC-05].
 */
export function createAuthRouter(
  authService: AuthService,
  sessionService: SessionService,
  redisService: RedisService,
  jwtService: JwtService,
): Router {
  // ── Rate limiters ────────────────────────────────────────────────────────
  // Prefixes must NOT start with "rl:" — createRateLimit adds that namespace.
  // Key pattern: rl:<prefix>:<ip>

  // Credential-based login — tightest limit: 5 attempts per 15 min per IP.
  const loginLimit = createRateLimit(redisService, {
    prefix: "login",
    limit: 5,
    windowSeconds: 60 * 15,
  });

  // Signup — 5 accounts per hour per IP to slow down bulk account creation.
  const signupLimit = createRateLimit(redisService, {
    prefix: "signup",
    limit: 5,
    windowSeconds: 60 * 60,
  });

  // Email-sending endpoints — shared limit to prevent email flooding.
  // 3 requests per 10 minutes per IP is permissive for real users but
  // expensive enough to deter automated abuse.
  const emailSendLimit = createRateLimit(redisService, {
    prefix: "email-send",
    limit: 3,
    windowSeconds: 60 * 10,
  });

  // OTP verify — bounded separately to limit code-guessing attempts.
  const otpVerifyLimit = createRateLimit(redisService, {
    prefix: "otp-verify",
    limit: 5,
    windowSeconds: 60 * 10,
  });

  const router = Router();
  const ctrl = new AuthController(authService, sessionService);

  // POST /auth/signup
  router.post("/signup", signupLimit, requireJsonBody, ctrl.signup);

  // POST /auth/login
  router.post("/login", loginLimit, requireJsonBody, ctrl.login);

  // POST /auth/logout — token is optional (best-effort session revocation)
  router.post("/logout", parseToken(jwtService), ctrl.logout);

  // POST /auth/refresh — reads only from cookie, no body required
  router.post("/refresh", ctrl.refresh);

  // POST /auth/magic-link/request
  router.post(
    "/magic-link/request",
    emailSendLimit,
    requireJsonBody,
    ctrl.requestMagicLink,
  );

  // GET /auth/magic-link/callback — query-param driven, no body
  router.get("/magic-link/callback", ctrl.magicLinkCallback);

  // POST /auth/otp/request
  router.post("/otp/request", emailSendLimit, requireJsonBody, ctrl.requestOtp);

  // POST /auth/otp/verify
  router.post("/otp/verify", otpVerifyLimit, requireJsonBody, ctrl.verifyOtp);

  // POST /auth/password-reset/request
  router.post(
    "/password-reset/request",
    emailSendLimit,
    requireJsonBody,
    ctrl.passwordResetRequest,
  );

  // POST /auth/password-reset
  router.post("/password-reset", requireJsonBody, ctrl.passwordReset);

  // GET /auth/verify-email?token=...
  router.get("/verify-email", ctrl.verifyEmailFromLink);

  // POST /auth/verify-email
  router.post("/verify-email", requireJsonBody, ctrl.verifyEmail);

  // POST /auth/resend-verification
  router.post(
    "/resend-verification",
    emailSendLimit,
    requireJsonBody,
    ctrl.resendVerification,
  );

  return router;
}
