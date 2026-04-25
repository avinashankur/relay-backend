import { Router } from "express";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { SessionService } from "../sessions/sessions.service";
import { RedisService } from "@/shared/services/redis.service";
import { createRateLimit } from "@/shared/middleware/rate-limit";
import { parseToken } from "@/shared/middleware/parse-token";
import { JwtService } from "@/shared/services/jwt.service";

export function createAuthRouter(
  authService: AuthService,
  sessionService: SessionService,
  redisService: RedisService,
): Router {
  const loginLimit = createRateLimit(redisService, {
    prefix: "rl:login",
    limit: 5,
    windowSeconds: 60 * 15,
  });
  const signupLimit = createRateLimit(redisService, {
    prefix: "rl:signup",
    limit: 5,
    windowSeconds: 60 * 60,
  });

  const router = Router();
  const ctrl = new AuthController(authService, sessionService);
  const jwtService = new JwtService();
  const tokenParser = parseToken(jwtService);

  // POST /auth/signup
  router.post("/signup", signupLimit, ctrl.signup);

  // POST /auth/login
  router.post("/login", loginLimit, ctrl.login);

  // POST /auth/logout
  router.post("/logout", tokenParser, ctrl.logout);

  // POST /auth/refresh
  router.post("/refresh", ctrl.refresh);

  // POST /auth/magic-link/request
  router.post("/magic-link/request", ctrl.requestMagicLink);

  // GET /auth/magic-link/callback
  router.get("/magic-link/callback", ctrl.magicLinkCallback);

  // POST /auth/otp/request
  router.post("/otp/request", ctrl.requestOtp);

  // POST /auth/otp/verify
  router.post("/otp/verify", ctrl.verifyOtp);

  // POST /auth/password-reset/request
  router.post("/password-reset/request", ctrl.passwordResetRequest);

  // POST /auth/password-reset
  router.post("/password-reset", ctrl.passwordReset);

  // POST /auth/verify-email
  router.post("/verify-email", ctrl.verifyEmail);

  return router;
}
