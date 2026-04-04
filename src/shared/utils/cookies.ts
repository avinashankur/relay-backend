import { env } from "@/config/env";
import type { Response } from "express";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const IS_PROD = env.NODE_ENV === "production";

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  const { accessToken, refreshToken } = tokens;

  const cookieOptions = {
    httpOnly: true,
    secure: IS_PROD, // false in dev to allow HTTP
    sameSite: (IS_PROD ? "strict" : "lax") as "strict" | "lax",
    domain: IS_PROD ? undefined : "localhost", // Share across localhost ports in dev
  };

  res.cookie("access_token", accessToken, {
    ...cookieOptions,
    path: "/",
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
  });

  res.cookie("refresh_token", refreshToken, {
    ...cookieOptions,
    path: IS_PROD ? "/api/auth/v1/refresh" : "/", // Allow all paths in dev for easier debugging
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "strict" : "lax") as "strict" | "lax",
    domain: IS_PROD ? undefined : "localhost",
  };

  res.clearCookie("access_token", {
    ...cookieOptions,
    path: "/",
  });

  res.clearCookie("refresh_token", {
    ...cookieOptions,
    path: IS_PROD ? "/api/auth/v1/refresh" : "/",
  });
}
