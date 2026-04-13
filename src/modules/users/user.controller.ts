import type { NextFunction, Request, Response } from "express";
import { success } from "@/shared/utils/response";
import { UserService } from "./users.service";
import { DeleteAccountSchema, UpdateProfileSchema } from "./users.validators";
import { ValidationError } from "@/shared/errors/ValidationError";

export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /me
  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.userService.getProfile(req.user!.id);
      res.status(200).json(success({ user }));
    } catch (error) {
      next(error);
    }
  };

  // PATCH /me
  updateMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = UpdateProfileSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const user = await this.userService.updateProfile(
        req.user!.id,
        body.data,
      );
      res.status(200).json(success({ user }));
    } catch (err) {
      next(err);
    }
  };

  // DELETE /me
  deleteMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = DeleteAccountSchema.safeParse(req.body);
      if (!body.success) throw ValidationError.fromZod(body.error);

      const result = await this.userService.deleteAccount(
        req.user!.id,
        req.ip ?? "",
      );
      res
        .status(200)
        .json(success({ scheduledHardDeleteAt: result.scheduledHardDeleteAt }));
    } catch (err) {
      next(err);
    }
  };
}
