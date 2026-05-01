import { Router } from "express";
import { UserService } from "./users.service";
import { UserController } from "./user.controller";
import { parseToken, requireAuth } from "@/shared/middleware";
import { JwtService } from "@/shared/services/jwt.service";

export function createUserRouter(
  userService: UserService,
  jwtService: JwtService,
): Router {
  const router = Router();
  const userController = new UserController(userService);

  router.use(parseToken(jwtService), requireAuth);

  // GET /user/me
  router.get("/me", userController.getMe);

  // PATCH /user/me
  router.patch("/me", userController.updateMe);

  // DELETE /user/me
  router.delete("/me", userController.deleteMe);

  return router;
}
