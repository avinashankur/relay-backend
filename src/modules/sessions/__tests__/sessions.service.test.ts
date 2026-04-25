// ── Mocked infrastructure ──────────────────────────────────────────────────────
// Must be declared before imports so Jest hoists them correctly.

// Generated Prisma client uses import.meta (ESM-only).
jest.mock("@/generated/prisma/client", () => ({ PrismaClient: jest.fn() }));

// AuditService pulls in Prisma + RedisService.
jest.mock("@/shared/services/audit.service", () => ({
  AuditService: jest.fn(),
}));

// EmailService imports BullMQ queue → Redis → env validation.
jest.mock("@/shared/services/email.service", () => ({
  EmailService: jest.fn(),
}));

// JwtService reads env at constructor time (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY).
jest.mock("@/shared/services/jwt.service", () => ({
  JwtService: jest.fn().mockImplementation(() => mockJwtService),
}));

import { SessionService } from "../sessions.service";
import { AuthError } from "@/shared/errors/AuthError";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// JwtService mock — referenced by the factory mock above.
const mockJwtService = {
  sign: jest.fn().mockResolvedValue("mock.access.token"),
  verify: jest.fn(),
};

const mockPrisma = {
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUniqueOrThrow: jest.fn(),
  },
};

const mockCryptoService = {
  generateToken: jest.fn().mockReturnValue({
    raw: "raw-refresh-token",
    hash: "hashed-refresh-token",
  }),
  sha256: jest.fn().mockReturnValue("hashed-refresh-token"),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logCritical: jest.fn().mockResolvedValue(undefined),
};

const mockRedisService = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
};

// ── Factory ────────────────────────────────────────────────────────────────────

function makeService() {
  return new SessionService(
    mockPrisma as unknown as ConstructorParameters<typeof SessionService>[0],
    mockAuditService as unknown as ConstructorParameters<
      typeof SessionService
    >[1],
    mockCryptoService as unknown as ConstructorParameters<
      typeof SessionService
    >[2],
    mockEmailService as unknown as ConstructorParameters<
      typeof SessionService
    >[3],
    mockRedisService as unknown as ConstructorParameters<
      typeof SessionService
    >[4],
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const baseUser = {
  id: "usr_01",
  email: "test@example.com",
  role: "USER",
  deletedAt: null,
  suspended: false,
};

const baseSession = {
  id: "sess_01",
  userId: "usr_01",
  refreshTokenHash: "hashed-refresh-token",
  ip: "1.2.3.4",
  deviceInfo: { ua: "Mozilla/5.0" },
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  lastSeenAt: new Date(),
  createdAt: new Date(),
  user: baseUser,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SessionService", () => {
  let service: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe("create", () => {
    beforeEach(() => {
      mockPrisma.session.create.mockResolvedValue(baseSession);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(baseUser);
    });

    it("returns accessToken and refreshToken on success", async () => {
      const result = await service.create({
        userId: "usr_01",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      });

      expect(result.accessToken).toBe("mock.access.token");
      expect(result.refreshToken).toBe("raw-refresh-token");
    });

    it("creates a session row in the DB with correct fields", async () => {
      await service.create({
        userId: "usr_01",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      });

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "usr_01",
            refreshTokenHash: "hashed-refresh-token",
            ip: "1.2.3.4",
          }),
        }),
      );
    });

    it("stores the session ID in Redis keyed by hashed refresh token", async () => {
      await service.create({
        userId: "usr_01",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      });

      expect(mockRedisService.set).toHaveBeenCalledWith(
        "session:refresh:hashed-refresh-token",
        baseSession.id,
        expect.any(Number),
      );
    });

    it("signs the access token with correct user claims", async () => {
      await service.create({
        userId: "usr_01",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: "usr_01",
          email: "test@example.com",
          role: "USER",
          sessionId: baseSession.id,
        }),
      );
    });

    it("sets a future expiresAt (~30 days) on the session", async () => {
      await service.create({
        userId: "usr_01",
        ip: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      });

      const callArg = mockPrisma.session.create.mock.calls[0][0];
      const expiresAt: Date = callArg.data.expiresAt;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThan(
        Date.now() + thirtyDaysMs - 5000,
      );
      expect(expiresAt.getTime()).toBeLessThan(
        Date.now() + thirtyDaysMs + 5000,
      );
    });
  });

  // ── rotateRefreshToken ────────────────────────────────────────────────────────

  describe("rotateRefreshToken", () => {
    it("returns new token pair when token is valid and not expired", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockCryptoService.generateToken.mockReturnValueOnce({
        raw: "new-raw-token",
        hash: "new-hash",
      });

      const result = await service.rotateRefreshToken(
        "old-raw-token",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(result.accessToken).toBe("mock.access.token");
      expect(result.refreshToken).toBe("new-raw-token");
    });

    it("deletes the old Redis key and stores the new hash", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockCryptoService.generateToken.mockReturnValueOnce({
        raw: "new-raw-token",
        hash: "new-hash",
      });

      await service.rotateRefreshToken(
        "old-raw-token",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(mockRedisService.del).toHaveBeenCalledWith(
        "session:refresh:hashed-refresh-token",
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "session:refresh:new-hash",
        baseSession.id,
        expect.any(Number),
      );
    });

    it("updates the session row with the new hash and lastSeenAt", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockCryptoService.generateToken.mockReturnValueOnce({
        raw: "new-raw-token",
        hash: "new-hash",
      });

      await service.rotateRefreshToken(
        "old-raw-token",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sess_01" },
          data: expect.objectContaining({
            refreshTokenHash: "new-hash",
            ip: "1.2.3.4",
          }),
        }),
      );
    });

    it("logs an audit event after successful rotation", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockCryptoService.generateToken.mockReturnValueOnce({
        raw: "new-raw-token",
        hash: "new-hash",
      });

      await service.rotateRefreshToken(
        "old-raw-token",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.token_refresh",
          userId: "usr_01",
        }),
      );
    });

    it("throws TOKEN_REUSE_DETECTED when hash is missing in Redis but session exists in DB", async () => {
      // Redis miss = token already rotated → reuse detected
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      // revokeAllForUser is called internally — needs findMany + deleteMany
      mockPrisma.session.findMany.mockResolvedValue([baseSession]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.rotateRefreshToken("reused-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);
    });

    it("revokes all sessions for the user on reuse detection", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      // revokeAllForUser uses findMany + deleteMany
      mockPrisma.session.findMany.mockResolvedValue([baseSession]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.rotateRefreshToken("reused-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "usr_01" } }),
      );
    });

    it("sends a security alert email on reuse detection", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockPrisma.session.findMany.mockResolvedValue([baseSession]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.rotateRefreshToken("reused-token", "1.2.3.4", "bot-agent"),
      ).rejects.toThrow(AuthError);

      expect(mockEmailService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          email: "test@example.com",
          alertType: "token_reuse",
        }),
      );
    });

    it("logs a critical audit event on reuse detection", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);
      mockPrisma.session.findMany.mockResolvedValue([baseSession]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.rotateRefreshToken("reused-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);

      expect(mockAuditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.token_reuse",
          userId: "usr_01",
        }),
      );
    });

    it("throws INVALID_TOKEN (without security alert) when hash is missing and no session exists", async () => {
      // Completely unknown token — nothing in Redis or DB
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken("unknown-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);

      expect(mockEmailService.sendSecurityAlert).not.toHaveBeenCalled();
    });

    it("throws TOKEN_EXPIRED when session expiresAt is in the past", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue({
        ...baseSession,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      await expect(
        service.rotateRefreshToken("old-raw-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);
    });

    it("throws ACCOUNT_DELETED when the associated user is soft-deleted", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue({
        ...baseSession,
        user: { ...baseUser, deletedAt: new Date() },
      });

      await expect(
        service.rotateRefreshToken("old-raw-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);
    });

    it("throws ACCOUNT_SUSPENDED when the associated user is suspended", async () => {
      mockRedisService.get.mockResolvedValue("sess_01");
      mockPrisma.session.findFirst.mockResolvedValue({
        ...baseSession,
        user: { ...baseUser, suspended: true },
      });

      await expect(
        service.rotateRefreshToken("old-raw-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);
    });

    it("cleans up the stale Redis key when session is not found in DB", async () => {
      mockRedisService.get.mockResolvedValue("sess_01"); // Redis has it
      mockPrisma.session.findFirst.mockResolvedValue(null); // But DB doesn't

      await expect(
        service.rotateRefreshToken("old-raw-token", "1.2.3.4", "Mozilla/5.0"),
      ).rejects.toThrow(AuthError);

      expect(mockRedisService.del).toHaveBeenCalledWith(
        "session:refresh:hashed-refresh-token",
      );
    });
  });

  // ── revokeByRefreshToken ──────────────────────────────────────────────────────

  describe("revokeByRefreshToken", () => {
    it("deletes the session from DB and removes its Redis key", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);

      await service.revokeByRefreshToken("raw-refresh-token");

      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: "sess_01" },
      });
      expect(mockRedisService.del).toHaveBeenCalledWith(
        "session:refresh:hashed-refresh-token",
      );
    });

    it("logs an audit event with session.revoked action", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(baseSession);

      await service.revokeByRefreshToken("raw-refresh-token");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "session.revoked",
          userId: "usr_01",
        }),
      );
    });

    it("is a no-op (does not throw) when session does not exist", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeByRefreshToken("unknown-token"),
      ).resolves.not.toThrow();

      expect(mockPrisma.session.delete).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  // ── revokeById ────────────────────────────────────────────────────────────────

  describe("revokeById", () => {
    it("deletes the session when the owner matches", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...baseSession,
        id: "sess_01",
      });

      await service.revokeById("sess_01", "usr_01");

      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: "sess_01" },
      });
    });

    it("throws ForbiddenError when the requesting user does not own the session", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...baseSession,
        id: "sess_01",
      });

      // Different userId — ownership check fails
      await expect(service.revokeById("sess_01", "usr_other")).rejects.toThrow(
        ForbiddenError,
      );

      expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    });

    it("throws AuthError when session is not found", async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.revokeById("sess_ghost", "usr_01")).rejects.toThrow(
        AuthError,
      );
    });

    it("logs an audit event on successful revocation by ID", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...baseSession,
        id: "sess_01",
      });

      await service.revokeById("sess_01", "usr_01");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "session.revoked",
          userId: "usr_01",
          metadata: expect.objectContaining({ sessionId: "sess_01" }),
        }),
      );
    });
  });

  // ── revokeAllForUser ──────────────────────────────────────────────────────────

  describe("revokeAllForUser", () => {
    it("deletes all sessions for the user from DB", async () => {
      mockPrisma.session.findMany.mockResolvedValue([
        baseSession,
        { ...baseSession, id: "sess_02", refreshTokenHash: "hash-2" },
      ]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.revokeAllForUser("usr_01");

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "usr_01" },
      });
    });

    it("removes every session's Redis key", async () => {
      mockPrisma.session.findMany.mockResolvedValue([
        { ...baseSession, refreshTokenHash: "hash-a" },
        { ...baseSession, id: "sess_02", refreshTokenHash: "hash-b" },
      ]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.revokeAllForUser("usr_01");

      expect(mockRedisService.del).toHaveBeenCalledWith(
        "session:refresh:hash-a",
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        "session:refresh:hash-b",
      );
    });

    it("logs an audit event with the session count", async () => {
      mockPrisma.session.findMany.mockResolvedValue([baseSession]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.revokeAllForUser("usr_01");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "session.revoked_all",
          userId: "usr_01",
          metadata: expect.objectContaining({ count: 1 }),
        }),
      );
    });

    it("is a no-op (no DB delete or Redis del) when user has no sessions", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });

      await service.revokeAllForUser("usr_01");

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "usr_01" },
      });
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });
  });

  // ── listAllForUser ────────────────────────────────────────────────────────────

  describe("listAllForUser", () => {
    it("returns only non-expired sessions for the user", async () => {
      const activeSessions = [
        {
          id: "sess_01",
          deviceInfo: { ua: "Chrome" },
          ip: "1.2.3.4",
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: "sess_02",
          deviceInfo: { ua: "Firefox" },
          ip: "5.6.7.8",
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockPrisma.session.findMany.mockResolvedValue(activeSessions);

      const result = await service.listAllForUser("usr_01");
      const [first, second] = result;

      expect(result).toHaveLength(2);
      expect(first?.id).toBe("sess_01");
      expect(second?.id).toBe("sess_02");
    });

    it("queries with expiresAt > now to filter expired sessions", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      await service.listAllForUser("usr_01");

      const callArg = mockPrisma.session.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({
        userId: "usr_01",
        expiresAt: { gt: expect.any(Date) },
      });
    });

    it("orders results by lastSeenAt descending", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      await service.listAllForUser("usr_01");

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastSeenAt: "desc" },
        }),
      );
    });

    it("returns an empty array when the user has no active sessions", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      const result = await service.listAllForUser("usr_01");

      expect(result).toEqual([]);
    });

    it("selects only the safe public session fields", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      await service.listAllForUser("usr_01");

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            deviceInfo: true,
            ip: true,
            lastSeenAt: true,
            createdAt: true,
          }),
        }),
      );
    });
  });
});
