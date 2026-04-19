import { PrismaClient, type UserRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";
import { NotFoundError } from "@/shared/errors/NotFoundError";
import { AuditService } from "@/shared/services/audit.service";
import { SessionService } from "../sessions/sessions.service";

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
  suspended: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  sessions: {
    id: string;
    deviceInfo: unknown;
    ip: string | null;
    lastSeenAt: Date;
    createdAt: Date;
  }[];
  auditEvents: {
    id: string;
    action: string;
    metadata: unknown;
    ip: string | null;
    createdAt: Date;
  }[];
}

export interface ListUsersOptions {
  cursor?: string;
  limit?: number;
  search?: string;
  role?: UserRole;
  suspended?: boolean;
}

export interface AuditLogOptions {
  cursor?: string;
  limit?: number;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export class AdminService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  // GET /admin/users
  async listUsers(options: ListUsersOptions): Promise<{
    users: AdminUserListItem[];
    nextCursor: string | null;
  }> {
    const limit = options.limit ?? 20;

    const users = await this.prisma.user.findMany({
      take: limit + 1,
      ...(options.cursor && { cursor: { id: options.cursor }, skip: 1 }),
      where: {
        ...(options.search && {
          OR: [
            { email: { contains: options.search, mode: "insensitive" } },
            { name: { contains: options.search, mode: "insensitive" } },
          ],
        }),
        ...(options.role !== undefined && { role: options.role }),
        ...(options.suspended !== undefined && {
          suspended: options.suspended,
        }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        suspended: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    const hasNextPage = users.length > limit;
    const page = hasNextPage ? users.slice(0, limit) : users;
    const nextCursor = hasNextPage ? page[page.length - 1]!.id : null;

    return { users: page, nextCursor };
  }

  // GET /admin/users/:id
  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        suspended: true,
        createdAt: true,
        deletedAt: true,
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { lastSeenAt: "desc" },
          select: {
            id: true,
            deviceInfo: true,
            ip: true,
            lastSeenAt: true,
            createdAt: true,
          },
        },
        auditEvents: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            action: true,
            metadata: true,
            ip: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", `User ${userId} not found`);
    }

    return user;
  }

  // PATCH /admin/users/:id/role
  async changeUserRole(
    userId: string,
    newRole: UserRole,
    adminId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, deletedAt: true },
    });

    if (!user) {
      throw new NotFoundError(
        "USER_NOT_FOUND",
        `User with user ID ${userId} not found`,
      );
    }

    if (user.deletedAt) {
      throw new ForbiddenError(
        "ACCOUNT_DELETED",
        "Cannot change role a deleted user",
      );
    }

    if (userId === adminId) {
      throw new ForbiddenError(
        "SELF_ACTION_FORBIDDEN",
        "Admins can not change their own role",
      );
    }

    const oldRole = user.role;

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    await this.auditService.log({
      action: "user.role_changed",
      userId: adminId,
      metadata: { userId, oldRole, newRole, changedBy: adminId },
    });
  }

  // POST /admin/users/:id/suspend
  async suspendUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        suspended: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", `User ${userId} not found`);
    }

    if (user.deletedAt) {
      throw new ForbiddenError(
        "ACCOUNT_DELETED",
        "Can't suspend a deleted user",
      );
    }

    if (userId == adminId) {
      throw new ForbiddenError(
        "SELF_ACTION_FORBIDDEN",
        "Admins can not suspend themselves",
      );
    }

    if (user.suspended) {
      throw new ForbiddenError("ACCOUNT_SUSPENDED", "User already suspended");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { suspended: true },
    });

    // immediately revoke all active sessions
    await this.sessionService.revokeAllForUser(userId);

    await this.auditService.log({
      action: "user.suspended",
      userId: adminId,
      metadata: { userId, suspendedBy: adminId },
    });
  }

  // GET /admin/audit
  async getAuditLog(options: AuditLogOptions): Promise<{
    events: {
      id: string;
      userId: string | null;
      action: string;
      metadata: unknown;
      ip: string | null;
      createdAt: Date;
    }[];
    nextCursor: string | null;
  }> {
    const limit = options.limit ?? 50;

    const events = await this.prisma.auditEvent.findMany({
      take: limit + 1,
      ...(options.cursor && { cursor: { id: options.cursor }, skip: 1 }),
      where: {
        ...(options.userId && { userId: options.userId }),
        ...(options.action && {
          action: { contains: options.action, mode: "insensitive" },
        }),
        ...((options.from || options.to) && {
          createdAt: {
            ...(options.from && { gte: options.from }),
            ...(options.to && { lte: options.to }),
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        action: true,
        metadata: true,
        ip: true,
        createdAt: true,
      },
    });

    const hasNextPage = events.length > limit;
    const page = hasNextPage ? events.slice(0, limit) : events;
    const nextCursor = hasNextPage ? page[page.length - 1]!.id : null;

    return { events: page, nextCursor };
  }
}
