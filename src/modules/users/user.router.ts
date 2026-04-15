import { Router } from "express";
import { UserService } from "./users.service";
import { UserController } from "./user.controller";
import { requireAuth } from "@/shared/middleware/require-auth";
import { parseToken } from "@/shared/middleware/parse-token";
import { JwtService } from "@/shared/services/jwt.service";

export function createUserRouter(userService: UserService): Router {
  const router = Router();
  const userController = new UserController(userService);
  const jwtService = new JwtService();
  const tokenParser = parseToken(jwtService);

  router.use(tokenParser, requireAuth);

  // GET /user/me
  router.get("/me", userController.getMe);

  // PATCH /user/me
  router.patch("/me", userController.updateMe);

  // DELETE /user/me
  router.delete("/me", userController.deleteMe);

  return router;
}
