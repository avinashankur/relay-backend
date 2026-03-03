import type { NextFunction, Request, Response } from "express";
import { signupSchema } from "./auth.validators";
import { ValidationError } from "../../shared/errors/ValidationError";
import type { AuthService } from "./auth.service";
import { success } from "../../shared/utils/response";

export class AuthController {
  constructor(private authService: AuthService) {}

  // —— POST /auth/signup
  signup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = signupSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const result = await this.authService.signup(body.data);

      res.status(201).json(success(result));
    } catch (error) {
      next(error);
    }
  };

  // —— POST /auth/login
  // returns 200 { user } + sets HttpOnly access_token + refresh_token cookies
  // login = async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction,
  // ): Promise<void> => {
    
  // };
}
