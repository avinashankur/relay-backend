import { PrismaClient } from "@/generated/prisma/client";
import { NotFoundError } from "@/shared/errors/NotFoundError";
import { AuditService } from "@/shared/services/audit.service";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";
import { SessionService } from "../sessions/sessions.service";
import type { UpdateProfileInput } from "./users.validators";
import type { EmailService } from "@/shared/services/email.service";

export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
}

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
  ) {}

  // GET /me
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    return user as PublicUser;
  }

  // PATCH /me
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const existing = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId,
      action: "user.profile_updated",
      metadata: {
        fields: Object.keys(input).filter(
          (k) => input[k as keyof UpdateProfileInput] !== undefined,
        ),
      },
    });

    return updatedUser as PublicUser;
  }

  // DELETE /me
  /**
   * Soft deletes a user
   * Revoke all the sessions immediately
   * Hard delete after 30 days
   */
  async deleteAccount(
    userId: string,
    ip: string,
  ): Promise<{ scheduledHardDeleteAt: Date }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    if (user.role === "ADMIN") {
      throw new ForbiddenError(
        "ADMIN_SELF_DELETE_FORBIDDEN",
        "Admin accounts cannot be deleted",
      );
    }

    const now = new Date();
    const scheduledHardDeleteAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ); // 30 days from now

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        deletedAt: now,
      },
    });

    await this.sessionService.revokeAllForUser(userId);

    await this.auditService.log({
      userId,
      action: "user.deleted",
      metadata: {
        scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
      },
      ip,
    });

    // Enqueue hard delete job (handled by a separate worker process)
    await this.emailService.sendSecurityAlert({
      userId,
      email: user.email,
      alertType: "account_deletion",
      scheduledAt: scheduledHardDeleteAt,
    });

    return { scheduledHardDeleteAt };
  }
}
