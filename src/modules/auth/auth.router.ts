import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

export function createAuthRouter(AuthService: AuthService) {
  const router = Router();
  const ctrl = new AuthController(AuthService);

  // POST /auth/signup
  router.post("/signup", ctrl.signup);

  return router;
}
