import type { Request, Response, NextFunction } from "express";
import { SessionService } from "./sessions.service";
import { ValidationError } from "@/shared/errors/ValidationError";
import { success } from "@/shared/utils/response";
import { clearAuthCookies } from "@/shared/utils/cookies";
import { RevokeSessionSchema } from "./sessions.validators";

export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  // GET /sessions
  // Returns all active (non-expired) sessions for the authenticated user
  listSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const sessions = await this.sessionService.listAllForUser(userId);
      res.status(200).json(success({ sessions }));
    } catch (err) {
      next(err);
    }
  };

  // DELETE /sessions/:id
  // Revokes a specific session — user must own it (403 otherwise)
  revokeSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = RevokeSessionSchema.safeParse(req.params);
      if (!result.success) {
        throw new ValidationError("VALIDATION_FAILED", "Invalid session ID");
      }

      const userId = req.user!.id;
      await this.sessionService.revokeById(result.data.id, userId);
      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };

  // DELETE /sessions
  // Revokes ALL sessions for the authenticated user (logout everywhere)
  // Also clears cookies for the current browser session
  revokeAllSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      await this.sessionService.revokeAllForUser(userId);
      clearAuthCookies(res);
      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };
}
