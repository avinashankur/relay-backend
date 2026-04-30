import { Router } from "express";
import { SessionService } from "./sessions.service";
import { requireAuth } from "@/shared/middleware/require-auth";
import { parseToken } from "@/shared/middleware/parse-token";
import { JwtService } from "@/shared/services/jwt.service";
import { SessionsController } from "./sessions.controllers";

export function createSessionsRouter(sessionService: SessionService): Router {
  const router = Router();
  const controller = new SessionsController(sessionService);
  const jwtService = new JwtService();
  const tokenParser = parseToken(jwtService);

  router.use(tokenParser, requireAuth);

  // GET    /sessions       — list all active sessions for the authenticated user
  // DELETE /sessions       — revoke all sessions (logout everywhere)
  // DELETE /sessions/:id   — revoke a specific session by ID
  router.get("/", controller.listSessions);
  router.delete("/", controller.revokeAllSessions);
  router.delete("/:id", controller.revokeSession);

  return router;
}
