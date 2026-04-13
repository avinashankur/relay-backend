import { Router } from "express";
import { redis } from "@/config/redis";
import { prisma } from "@/config/prisma";
import { UserService } from "./users.service";
import { UserController } from "./user.controller";
import { SessionService } from "../sessions/sessions.service";
import { AuditService } from "@/shared/services/audit.service";
import { EmailService } from "@/shared/services/email.service";
import { CryptoService } from "@/shared/services/crypto.service";
import { RedisService } from "@/shared/services/redis.service";
import { requireAuth } from "@/shared/middleware/require-auth";

const router = Router();

const redisService = new RedisService(redis);
const auditService = new AuditService(prisma, redisService);
const emailService = new EmailService();
const cryptoService = new CryptoService();
const sessionService = new SessionService(
  prisma,
  auditService,
  cryptoService,
  emailService,
  redisService,
);
const userService = new UserService(
  prisma,
  auditService,
  sessionService,
  emailService,
);
const userController = new UserController(userService);

router.use(requireAuth);

router.get("/", userController.getMe);
router.patch("/", userController.updateMe);
router.delete("/", userController.deleteMe);

export { router as userRouter };
