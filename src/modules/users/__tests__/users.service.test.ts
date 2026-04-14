// All mocks must be declared before imports so Jest hoists them correctly.

// Generated Prisma client uses import.meta (ESM-only) — mock at module level.
jest.mock("@/generated/prisma/client", () => ({ PrismaClient: jest.fn() }));

// SessionService pulls in PrismaClient, JwtService (reads env), RedisService.
jest.mock("@/modules/sessions/sessions.service", () => ({
  SessionService: jest.fn(),
}));

// AuditService imports Prisma + RedisService.
jest.mock("@/shared/services/audit.service", () => ({
  AuditService: jest.fn(),
}));

// EmailService imports the BullMQ email queue which imports Redis + env config.
jest.mock("@/shared/services/email.service", () => ({
  EmailService: jest.fn(),
}));

import { UserService } from "../users.service";
import { NotFoundError } from "@/shared/errors/NotFoundError";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSessionService = {
  revokeAllForUser: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
};

// ── Factory ────────────────────────────────────────────────────────────────────

function makeService() {
  return new UserService(
    mockPrisma as unknown as ConstructorParameters<typeof UserService>[0],
    mockAuditService as unknown as ConstructorParameters<typeof UserService>[1],
    mockSessionService as unknown as ConstructorParameters<
      typeof UserService
    >[2],
    mockEmailService as unknown as ConstructorParameters<typeof UserService>[3],
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const baseUser = {
  id: "usr_01",
  email: "test@example.com",
  emailVerified: true,
  name: "Test User",
  avatarUrl: null,
  role: "USER" as const,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deletedAt: null,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── getProfile ───────────────────────────────────────────────────────────────

  describe("getProfile", () => {
    it("returns public user fields for an existing non-deleted user", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);

      const result = await service.getProfile("usr_01");

      expect(result.id).toBe("usr_01");
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
      expect(result.emailVerified).toBe(true);
      expect(result.role).toBe("USER");
      expect(result.avatarUrl).toBeNull();
      expect(result.createdAt).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    });

    it("queries with deletedAt: null to exclude soft-deleted users", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);

      await service.getProfile("usr_01");

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_01", deletedAt: null },
        }),
      );
    });

    it("selects only public fields (no sensitive data returned)", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);

      await service.getProfile("usr_01");

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            email: true,
            emailVerified: true,
            name: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          }),
        }),
      );
    });

    it("throws NotFoundError when user does not exist", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getProfile("usr_ghost")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError when user is soft-deleted (filtered out by query)", async () => {
      // Prisma returns null because the where clause filters out deleted users
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getProfile("usr_01")).rejects.toThrow(NotFoundError);
    });

    it("returns a user with a null name (optional field)", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...baseUser, name: null });

      const result = await service.getProfile("usr_01");

      expect(result.name).toBeNull();
    });

    it("returns a user with an avatarUrl set", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        avatarUrl: "https://cdn.example.com/avatar.jpg",
      });

      const result = await service.getProfile("usr_01");

      expect(result.avatarUrl).toBe("https://cdn.example.com/avatar.jpg");
    });
  });

  // ── updateProfile ────────────────────────────────────────────────────────────

  describe("updateProfile", () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    });

    it("updates name and returns the updated public user", async () => {
      const updated = { ...baseUser, name: "New Name" };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile("usr_01", {
        name: "New Name",
      });

      expect(result.name).toBe("New Name");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_01" },
          data: { name: "New Name" },
        }),
      );
    });

    it("updates avatarUrl and returns the updated public user", async () => {
      const updated = {
        ...baseUser,
        avatarUrl: "https://cdn.example.com/new-avatar.jpg",
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile("usr_01", {
        avatarUrl: "https://cdn.example.com/new-avatar.jpg",
      });

      expect(result.avatarUrl).toBe("https://cdn.example.com/new-avatar.jpg");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { avatarUrl: "https://cdn.example.com/new-avatar.jpg" },
        }),
      );
    });

    it("updates both name and avatarUrl simultaneously", async () => {
      const updated = {
        ...baseUser,
        name: "Jane Doe",
        avatarUrl: "https://cdn.example.com/jane.jpg",
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      await service.updateProfile("usr_01", {
        name: "Jane Doe",
        avatarUrl: "https://cdn.example.com/jane.jpg",
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: "Jane Doe",
            avatarUrl: "https://cdn.example.com/jane.jpg",
          },
        }),
      );
    });

    it("does not include undefined fields in the update data", async () => {
      mockPrisma.user.update.mockResolvedValue(baseUser);

      // Only name provided — avatarUrl should NOT appear in the data object
      await service.updateProfile("usr_01", { name: "Only Name" });

      const callArg = mockPrisma.user.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty("avatarUrl");
    });

    it("logs an audit event with updated field names", async () => {
      mockPrisma.user.update.mockResolvedValue({
        ...baseUser,
        name: "Audited",
      });

      await service.updateProfile("usr_01", { name: "Audited" });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          action: "user.profile_updated",
          metadata: expect.objectContaining({
            fields: expect.arrayContaining(["name"]),
          }),
        }),
      );
    });

    it("logs correct fields when both name and avatarUrl are provided", async () => {
      mockPrisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile("usr_01", {
        name: "Both Fields",
        avatarUrl: "https://example.com/img.png",
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            fields: expect.arrayContaining(["name", "avatarUrl"]),
          }),
        }),
      );
    });

    it("selects only public fields on update", async () => {
      mockPrisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile("usr_01", { name: "Test" });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            email: true,
            emailVerified: true,
            name: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          }),
        }),
      );
    });

    it("throws NotFoundError when user does not exist", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile("usr_ghost", { name: "Ghost" }),
      ).rejects.toThrow(NotFoundError);

      // update should never be called
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundError for a soft-deleted user", async () => {
      // Prisma returns null because deletedAt: null filter excludes them
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile("usr_01", { name: "Updated" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("does not call audit service when user is not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile("usr_ghost", { name: "Nope" }),
      ).rejects.toThrow(NotFoundError);

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  // ── deleteAccount ────────────────────────────────────────────────────────────

  describe("deleteAccount", () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);
      mockPrisma.user.update.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });
    });

    it("soft-deletes the user by setting deletedAt to now", async () => {
      await service.deleteAccount("usr_01", "1.2.3.4");

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_01" },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it("returns scheduledHardDeleteAt ~30 days from now", async () => {
      const before = Date.now();
      const result = await service.deleteAccount("usr_01", "1.2.3.4");
      const after = Date.now();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const deletedAt = result.scheduledHardDeleteAt.getTime();

      expect(deletedAt).toBeGreaterThanOrEqual(before + thirtyDaysMs);
      expect(deletedAt).toBeLessThanOrEqual(after + thirtyDaysMs);
    });

    it("revokes all active sessions for the user", async () => {
      await service.deleteAccount("usr_01", "1.2.3.4");

      expect(mockSessionService.revokeAllForUser).toHaveBeenCalledWith(
        "usr_01",
      );
    });

    it("logs an audit event with USER_DELETED action and scheduledHardDeleteAt metadata", async () => {
      await service.deleteAccount("usr_01", "1.2.3.4");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          action: "user.deleted",
          ip: "1.2.3.4",
          metadata: expect.objectContaining({
            scheduledHardDeleteAt: expect.any(String),
          }),
        }),
      );
    });

    it("sends a security alert email with account_deletion type and scheduledAt", async () => {
      await service.deleteAccount("usr_01", "1.2.3.4");

      expect(mockEmailService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          email: "test@example.com",
          alertType: "account_deletion",
          scheduledAt: expect.any(Date),
        }),
      );
    });

    it("sends the correct scheduledAt that matches the returned scheduledHardDeleteAt", async () => {
      const result = await service.deleteAccount("usr_01", "1.2.3.4");

      const emailCallArg = mockEmailService.sendSecurityAlert.mock.calls[0][0];
      expect(emailCallArg.scheduledAt.getTime()).toBe(
        result.scheduledHardDeleteAt.getTime(),
      );
    });

    it("throws ForbiddenError when an admin tries to self-delete", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        role: "ADMIN",
      });

      await expect(
        service.deleteAccount("usr_admin", "1.2.3.4"),
      ).rejects.toThrow(ForbiddenError);
    });

    it("does not soft-delete, revoke sessions, or send email when admin tries to self-delete", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        role: "ADMIN",
      });

      await expect(
        service.deleteAccount("usr_admin", "1.2.3.4"),
      ).rejects.toThrow(ForbiddenError);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockSessionService.revokeAllForUser).not.toHaveBeenCalled();
      expect(mockEmailService.sendSecurityAlert).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when user does not exist", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAccount("usr_ghost", "1.2.3.4"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an already soft-deleted user", async () => {
      // Prisma returns null because deletedAt: null filter excludes them
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.deleteAccount("usr_01", "1.2.3.4")).rejects.toThrow(
        NotFoundError,
      );

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("does not call audit service or session revocation when user not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAccount("usr_ghost", "1.2.3.4"),
      ).rejects.toThrow(NotFoundError);

      expect(mockAuditService.log).not.toHaveBeenCalled();
      expect(mockSessionService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("passes the caller's IP address to the audit log", async () => {
      await service.deleteAccount("usr_01", "99.88.77.66");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "99.88.77.66" }),
      );
    });

    it("scheduledHardDeleteAt iso string in audit metadata starts with expected year", async () => {
      const result = await service.deleteAccount("usr_01", "1.2.3.4");

      const auditCallArg = mockAuditService.log.mock.calls[0][0];
      const iso: string = auditCallArg.metadata.scheduledHardDeleteAt;

      // Must be a valid ISO string representing a future date
      expect(new Date(iso).getTime()).toBe(
        result.scheduledHardDeleteAt.getTime(),
      );
    });
  });
});
