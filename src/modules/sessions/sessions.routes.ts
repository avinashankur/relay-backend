import { Router } from "express";
import { SessionService } from "./sessions.service";
import { parseToken, requireAuth, requireSession } from "@/shared/middleware";
import { JwtService } from "@/shared/services/jwt.service";
import { SessionsController } from "./sessions.controllers";
import { PrismaClient } from "@/generated/prisma/client";

export function createSessionsRouter(
  sessionService: SessionService,
  jwtService: JwtService,
  prisma: PrismaClient,
): Router {
  const router = Router();
  const controller = new SessionsController(sessionService);

  // All session routes require a valid, live session.
  // requireSession adds a DB liveness check so that a revoked session cannot
  // be used to list or revoke other sessions during the JWT TTL window.
  router.use(parseToken(jwtService), requireAuth, requireSession(prisma));

  // GET    /sessions       — list all active sessions for the authenticated user
  // DELETE /sessions       — revoke all sessions (logout everywhere)
  // DELETE /sessions/:id   — revoke a specific session by ID
  router.get("/", controller.listSessions);
  router.delete("/", controller.revokeAllSessions);
  router.delete("/:id", controller.revokeSession);

  return router;
}
