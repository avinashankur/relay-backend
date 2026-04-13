import type { Request, Response, NextFunction } from "express";
import { JwtService } from "@/shared/services/jwt.service";

export function parseToken(jwtService: JwtService) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.cookies?.access_token as string | undefined;

      if (!token) {
        return next();
      }

      const payload = await jwtService.verify(token);
      req.user = {
        id: payload.sub,
        role: payload.role,
      };
    } catch {
      // Invalid/expired token — don't throw, just don't populate req.user
      // requireAuth middleware will handle the 401 if the route needs it
    }

    next();
  };
}
