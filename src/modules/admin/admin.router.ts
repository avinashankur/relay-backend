import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { SessionService } from "../sessions/sessions.service";
import { requireAuth } from "@/shared/middleware/require-auth";
import { parseToken } from "@/shared/middleware/parse-token";
import { JwtService } from "@/shared/services/jwt.service";
import { PrismaClient } from "@/generated/prisma/client";
import { AuditService } from "@/shared/services/audit.service";
import { requireRole } from "@/shared/middleware/require-role";

export function createAdminRouter(
  prisma: PrismaClient,
  sessionService: SessionService,
  auditService: AuditService,
): Router {
  const router = Router();

  const adminService = new AdminService(prisma, auditService, sessionService);
  const controller = new AdminController(adminService);

  const jwtService = new JwtService();
  const tokenParser = parseToken(jwtService);

  // All admin routes require a valid session AND the ADMIN role
  router.use(tokenParser);
  router.use(requireAuth);
  router.use(requireRole("ADMIN"));

  // Users
  router.get("/users", controller.listUsers);
  router.get("/users/:id", controller.getUserDetail);
  router.patch("/users/:id/role", controller.changeUserRole);
  router.post("/users/:id/suspend", controller.suspendUser);

  // Audit log
  router.get("/audit", controller.getAuditLog);

  return router;
}
