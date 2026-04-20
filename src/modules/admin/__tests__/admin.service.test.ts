// All mocks must be declared before imports so Jest hoists them correctly.

// Generated Prisma client uses import.meta (ESM-only) — mock at module level.
jest.mock("@/generated/prisma/client", () => ({ PrismaClient: jest.fn() }));

// AuditService imports Prisma + RedisService.
jest.mock("@/shared/services/audit.service", () => ({
  AuditService: jest.fn(),
}));

// SessionService
jest.mock("@/modules/sessions/sessions.service", () => ({
  SessionService: jest.fn(),
}));

import { AdminService } from "../admin.service";
import { NotFoundError } from "@/shared/errors/NotFoundError";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditEvent: {
    findMany: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSessionService = {
  revokeAllForUser: jest.fn().mockResolvedValue(undefined),
};

// ── Factory ────────────────────────────────────────────────────────────────────

function makeService() {
  return new AdminService(
    mockPrisma as unknown as ConstructorParameters<typeof AdminService>[0],
    mockAuditService as unknown as ConstructorParameters<
      typeof AdminService
    >[1],
    mockSessionService as unknown as ConstructorParameters<
      typeof AdminService
    >[2],
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const baseUser = {
  id: "usr_01",
  email: "test@example.com",
  emailVerified: true,
  name: "Test User",
  role: "USER" as const,
  suspended: false,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const baseAdmin = {
  id: "admin_01",
  email: "admin@example.com",
  emailVerified: true,
  name: "Admin User",
  role: "ADMIN" as const,
  suspended: false,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deletedAt: null,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── listUsers ───────────────────────────────────────────────────────────────

  describe("listUsers", () => {
    it("returns a list of users and nextCursor", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        baseUser,
        { ...baseUser, id: "usr_02" },
      ]);

      const result = await service.listUsers({ limit: 1 });

      expect(result.users.length).toBe(1);
      expect(result.nextCursor).toBe("usr_01");
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
        }),
      );
    });

    it("returns nextCursor as null if no more users", async () => {
      mockPrisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await service.listUsers({ limit: 10 });

      expect(result.users.length).toBe(1);
      expect(result.nextCursor).toBeNull();
    });

    it("filters by search (email or name)", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.listUsers({ search: "test" });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: "test", mode: "insensitive" } },
              { name: { contains: "test", mode: "insensitive" } },
            ],
          },
        }),
      );
    });

    it("filters by role", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.listUsers({ role: "ADMIN" });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "ADMIN" },
        }),
      );
    });

    it("filters by suspended status", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.listUsers({ suspended: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { suspended: true },
        }),
      );
    });
  });

  // ── getUserDetail ────────────────────────────────────────────────────────────

  describe("getUserDetail", () => {
    it("returns user details including sessions and auditEvents", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        sessions: [],
        auditEvents: [],
      });

      const result = await service.getUserDetail("usr_01");

      expect(result.id).toBe("usr_01");
      expect(result.sessions).toEqual([]);
      expect(result.auditEvents).toEqual([]);
    });

    it("throws NotFoundError if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserDetail("usr_ghost")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ── changeUserRole ──────────────────────────────────────────────────────────

  describe("changeUserRole", () => {
    it("changes a user's role and logs it", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPrisma.user.update.mockResolvedValue({ ...baseUser, role: "ADMIN" });

      await service.changeUserRole("usr_01", "ADMIN", "admin_01");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "usr_01" },
        data: { role: "ADMIN" },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.role_changed",
          userId: "admin_01",
          metadata: expect.objectContaining({
            userId: "usr_01",
            oldRole: "USER",
            newRole: "ADMIN",
            changedBy: "admin_01",
          }),
        }),
      );
    });

    it("throws NotFoundError if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changeUserRole("usr_ghost", "ADMIN", "admin_01"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if user is soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await expect(
        service.changeUserRole("usr_01", "ADMIN", "admin_01"),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError if admin tries to change their own role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseAdmin);

      await expect(
        service.changeUserRole("admin_01", "USER", "admin_01"),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ── suspendUser ─────────────────────────────────────────────────────────────

  describe("suspendUser", () => {
    it("suspends a user, revokes sessions, and logs it", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPrisma.user.update.mockResolvedValue({
        ...baseUser,
        suspended: true,
      });

      await service.suspendUser("usr_01", "admin_01");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "usr_01" },
        data: { suspended: true },
      });
      expect(mockSessionService.revokeAllForUser).toHaveBeenCalledWith(
        "usr_01",
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.suspended",
          userId: "admin_01",
        }),
      );
    });

    it("throws NotFoundError if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendUser("usr_ghost", "admin_01"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if user is soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await expect(service.suspendUser("usr_01", "admin_01")).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("throws ForbiddenError if admin tries to suspend themselves", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseAdmin);

      await expect(service.suspendUser("admin_01", "admin_01")).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("throws ForbiddenError if user is already suspended", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        suspended: true,
      });

      await expect(service.suspendUser("usr_01", "admin_01")).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  // ── getAuditLog ─────────────────────────────────────────────────────────────

  describe("getAuditLog", () => {
    const baseEvent = {
      id: "evt_01",
      userId: "usr_01",
      action: "test.action",
      metadata: {},
      ip: "1.2.3.4",
      createdAt: new Date(),
    };

    it("returns a list of events and nextCursor", async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        baseEvent,
        { ...baseEvent, id: "evt_02" },
      ]);

      const result = await service.getAuditLog({ limit: 1 });

      expect(result.events.length).toBe(1);
      expect(result.nextCursor).toBe("evt_01");
      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
        }),
      );
    });

    it("returns nextCursor as null if no more events", async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([baseEvent]);

      const result = await service.getAuditLog({ limit: 10 });

      expect(result.events.length).toBe(1);
      expect(result.nextCursor).toBeNull();
    });

    it("filters by userId", async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([]);

      await service.getAuditLog({ userId: "usr_01" });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "usr_01" },
        }),
      );
    });
  });
});
