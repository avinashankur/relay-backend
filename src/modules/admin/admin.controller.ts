import type { Request, Response, NextFunction } from "express";
import type { AdminService } from "./admin.service";
import {
  AdminUserParamsSchema,
  AuditLogQuerySchema,
  ChangeRoleSchema,
  ListUsersQuerySchema,
} from "./admin.validators";
import { parse } from "@/shared/utils/parse";
import { success } from "@/shared/utils/response";

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // GET /admin/users
  listUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = parse(ListUsersQuerySchema, req.query);
      const { users, nextCursor } = await this.adminService.listUsers(query);
      res.status(200).json(success({ users, nextCursor }));
    } catch (err) {
      next(err);
    }
  };

  // GET /admin/users/:id
  getUserDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = parse(AdminUserParamsSchema, req.params);
      const user = await this.adminService.getUserDetail(id);
      res.status(200).json(success({ user }));
    } catch (err) {
      next(err);
    }
  };

  // PATCH /admin/users/:id/role
  changeUserRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id: targetUserId } = parse(AdminUserParamsSchema, req.params);
      const { role: newRole } = parse(ChangeRoleSchema, req.body);
      const adminId = req.user!.id;

      await this.adminService.changeUserRole(targetUserId, newRole, adminId);
      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };

  // POST /admin/users/:id/suspend
  suspendUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id: targetUserId } = parse(AdminUserParamsSchema, req.params);
      const adminId = req.user!.id;
      await this.adminService.suspendUser(targetUserId, adminId);

      res.status(200).json(success(null));
    } catch (err) {
      next(err);
    }
  };

  // GET /admin/audit
  getAuditLog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = parse(AuditLogQuerySchema, req.query);
      const { events, nextCursor } = await this.adminService.getAuditLog(query);

      res.status(200).json(success({ events, nextCursor }));
    } catch (err) {
      next(err);
    }
  };
}
