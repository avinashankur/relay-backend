import type { NextFunction, Request, Response } from "express";
import {
  emailVerifySchema,
  loginSchema,
  magicLinkCallbackQuerySchema,
  magicLinkRequestSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  signupSchema,
} from "./auth.validators";
import { success } from "@/shared/utils/response";
import { AuthService } from "./auth.service";
import { ValidationError } from "@/shared/errors/ValidationError";
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
      const body = signupSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      const result = await this.authService.signup(body.data, ip, userAgent);

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
      const body = loginSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      const result = await this.authService.login(body.data, ip, userAgent);

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
    } catch (error) {
      next(error);
    }

    clearAuthCookies(res);
    res.status(200).json(success({ message: "Logged out successfully" }));
  };

  // POST /auth/refresh
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

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

      const body = magicLinkRequestSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      console.log("[DEBUG] Parsed body.data:", body.data);

      await this.authService.requestMagicLink(
        body.data.email,
        body.data.redirectUrl,
      );
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
      const body = magicLinkCallbackQuerySchema.safeParse(req.query);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") ?? "unknown";

      const { accessToken, refreshToken, redirectUrl } =
        await this.authService.consumeMagicLink(body.data.token, ip, userAgent);

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
      const body = otpRequestSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      await this.authService.requestOtp(body.data.email);
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
      const body = otpVerifySchema.safeParse(req.body);
      if (!body.success) {
        throw new ValidationError("VALIDATION_FAILED", "Invalid input");
      }

      const ip = req.ip ?? "unknown";
      const userAgent = req.get("User-Agent") ?? "unknown";

      const { accessToken, refreshToken, user } =
        await this.authService.verifyOtp(
          body.data.email,
          body.data.code,
          ip,
          userAgent,
        );

      setAuthCookies(res, { accessToken, refreshToken });
      res.status(200).json(success({ user }));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/password/reset-request
  // Always returns 200, no email enumeration
  passwordResetRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = passwordResetRequestSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      await this.authService.requestPasswordReset(body.data.email);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/password/reset
  // Applies new password, revokes all sessions
  passwordReset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = passwordResetSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      await this.authService.resetPassword(
        body.data.token,
        body.data.newPassword,
      );
      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };

  // GET /auth/email/verify?token=...
  // Marks the user's email as verified
  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = emailVerifySchema.safeParse(req.query);
      if (!body.success) throw ValidationError.fromZod(body.error);

      await this.authService.verifyEmail(body.data.token);
      res.status(200).json(success(null));
    } catch (error) {
      next(error);
    }
  };
}
