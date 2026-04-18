import { PrismaClient, type UserRole } from "@/generated/prisma/client";
import { NotFoundError } from "@/shared/errors/NotFoundError";

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

export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

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
}
