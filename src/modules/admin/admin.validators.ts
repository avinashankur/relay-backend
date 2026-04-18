import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";

export const AdminUserParamsSchema = z.object({
  id: z.cuid({ message: "Invalid user ID" }),
});

// PATCH /admin/users/:id/role
export const ChangeRoleSchema = z.object({
  role: z.enum(UserRole),
});

// GET /admin/users
export const ListUsersQuerySchema = z.object({
  cursor: z.cuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().min(1).max(100).optional(),
  role: z.enum(UserRole).optional(),
  suspended: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
});

// GET /admin/audit
export const AuditLogQuerySchema = z.object({
  cursor: z.cuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
  userId: z.cuid().optional(),
  action: z.string().min(1).max(100).optional(),
  from: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
  to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .pipe(z.date().optional()),
});
