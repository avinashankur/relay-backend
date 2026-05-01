import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { SessionService } from "../sessions/sessions.service";
import {
  parseToken,
  requireAuth,
  requireRole,
  requireSession,
} from "@/shared/middleware";
import { JwtService } from "@/shared/services/jwt.service";
import { PrismaClient } from "@/generated/prisma/client";
import { AuditService } from "@/shared/services/audit.service";

export function createAdminRouter(
  prisma: PrismaClient,
  sessionService: SessionService,
  auditService: AuditService,
  jwtService: JwtService,
): Router {
  const router = Router();

  const adminService = new AdminService(prisma, auditService, sessionService);
  const controller = new AdminController(adminService);

  // All admin routes require:
  //   1. A valid, parseable access token (parseToken)
  //   2. An authenticated user (requireAuth)
  //   3. A live session in DB — prevents revoked tokens from reaching admin APIs (requireSession)
  //   4. The ADMIN role (requireRole)
  router.use(
    parseToken(jwtService),
    requireAuth,
    requireSession(prisma),
    requireRole("ADMIN"),
  );

  // Users
  router.get("/users", controller.listUsers);
  router.get("/users/:id", controller.getUserDetail);
  router.patch("/users/:id/role", controller.changeUserRole);
  router.post("/users/:id/suspend", controller.suspendUser);

  // Audit log
  router.get("/audit", controller.getAuditLog);

  return router;
}
