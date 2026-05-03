import type { NextFunction, Request, Response } from "express";
import {
  emailVerifySchema,
  emailVerifyQuerySchema,
  loginSchema,
  magicLinkCallbackQuerySchema,
  magicLinkRequestSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  resendVerificationSchema,
  signupSchema,
} from "./auth.validators";
import { success } from "@/shared/utils/response";
import { AuthService } from "./auth.service";
import { parse } from "@/shared/utils/parse";
import { logger } from "@/config/logger";
import { clearAuthCookies, setAuthCookies } from "@/shared/utils/cookies";
import { SessionService } from "../sessions/sessions.service";
import { AuthError } from "@/shared/errors/AuthError";

export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  // POST /auth/signup
  signup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(signupSchema, req.body);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      const result = await this.authService.signup(body, ip, userAgent);

      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      res.status(201).json(success(result));
    } catch (error) {
      logger.error({ error }, "Signup failed");
      next(error);
    }
  };

  // POST /auth/login
  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(loginSchema, req.body);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      const result = await this.authService.login(body, ip, userAgent);

      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      res.status(200).json(success(result));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/logout
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (typeof refreshToken === "string" && refreshToken.length > 0) {
        await this.sessionService.revokeByRefreshToken(refreshToken);
      }

      clearAuthCookies(res);
      res.status(200).json(success({ message: "Logged out successfully" }));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/refresh
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (typeof refreshToken !== "string" || refreshToken.length === 0) {
        throw new AuthError("MISSING_REFRESH_TOKEN", "Invalid refresh token");
      }

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") ?? "unknown";

      const { accessToken, refreshToken: newRefreshToken } =
        await this.sessionService.rotateRefreshToken(
          refreshToken,
          ip,
          userAgent,
        );

      setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
      res.status(200).json(success("Token refreshed successfully"));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/magic-link
  // Always return 200 with a generic message to prevent email enumeration
  requestMagicLink = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      console.log("[DEBUG] Magic link request body:", req.body);

      const body = parse(magicLinkRequestSchema, req.body);

      console.log("[DEBUG] Parsed body:", body);

      await this.authService.requestMagicLink(body.email, body.redirectUrl);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // GET /auth/magic-link/callback?token=...
  // Validates token, creates session, redirects to redirectUrl
  magicLinkCallback = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(magicLinkCallbackQuerySchema, req.query);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") ?? "unknown";

      const { accessToken, refreshToken, redirectUrl } =
        await this.authService.consumeMagicLink(body.token, ip, userAgent);

      setAuthCookies(res, { accessToken, refreshToken });
      res.redirect(redirectUrl);
      // res.status(200).json(success({ redirectUrl }));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/otp/request
  // Always returns 200 -- no email enumeration
  requestOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parse(otpRequestSchema, req.body);

      await this.authService.requestOtp(body.email);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/otp/verify
  // Returns 200 { user } + sets cookies on success
  verifyOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(otpVerifySchema, req.body);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") ?? "unknown";

      const { accessToken, refreshToken, user } =
        await this.authService.verifyOtp(body.email, body.code, ip, userAgent);

      setAuthCookies(res, { accessToken, refreshToken });
      res.status(200).json(success({ user }));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/password-reset/request
  // Always returns 200, no email enumeration
  passwordResetRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = parse(passwordResetRequestSchema, req.body);

      await this.authService.requestPasswordReset(body.email);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/password-reset
  // Applies new password, revokes all sessions
  passwordReset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(passwordResetSchema, req.body);

      await this.authService.resetPassword(body.token, body.newPassword);
      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };

  // POST /auth/verify-email
  // Marks the user's email as verified
  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parse(emailVerifySchema, req.body);

      await this.authService.verifyEmail(body.token);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // GET /auth/verify-email?token=...
  // Clickable verification-email callback.
  verifyEmailFromLink = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = parse(emailVerifyQuerySchema, req.query);

      await this.authService.verifyEmail(query.token);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/resend-verification
  // Always returns 200 — no email enumeration.
  resendVerification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = parse(resendVerificationSchema, req.body);

      await this.authService.resendVerificationEmail(body.email);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };
}
