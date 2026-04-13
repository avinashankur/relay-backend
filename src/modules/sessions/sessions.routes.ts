import { Router } from "express";
import { SessionService } from "./sessions.service";
import { requireAuth } from "@/shared/middleware/require-auth";

import { prisma } from "@/config/prisma";
import { redis } from "@/config/redis";
import { AuditService } from "@/shared/services/audit.service";
import { CryptoService } from "@/shared/services/crypto.service";
import { EmailService } from "@/shared/services/email.service";
import { SessionsController } from "./sessions.controllers";
import { RedisService } from "@/shared/services/redis.service";

const redisService = new RedisService(redis);
const auditService = new AuditService(prisma, redisService);
const cryptoService = new CryptoService();
const emailService = new EmailService();

const sessionService = new SessionService(
  prisma,
  auditService,
  cryptoService,
  emailService,
  redisService,
);

const controller = new SessionsController(sessionService);

const router = Router();

router.use(requireAuth);

// GET    /sessions
// DELETE /sessions
// DELETE /sessions/:id
router.get("/", controller.listSessions);
router.delete("/", controller.revokeAllSessions);
router.delete("/:id", controller.revokeSession);

export { router as sessionsRouter };
