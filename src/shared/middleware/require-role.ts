import type { Request, Response, NextFunction } from "express";
import { UserRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(
        new ForbiddenError("INSUFFICIENT_ROLE", "Authentication required"),
      );
    }

    if (!roles.includes(user.role)) {
      return next(
        new ForbiddenError(
          "INSUFFICIENT_ROLE",
          `Required role: ${roles.join(" or ")}. Current role: ${user.role}`,
        ),
      );
    }

    next();
  };
}
