import { AuthService } from "../auth.service";
import { AuthError } from "@/shared/errors/AuthError";
import { ValidationError } from "@/shared/errors/ValidationError";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  authAccount: {
    updateMany: jest.fn(),
  },
};

const mockPasswordStrategy = {
  hash: jest.fn().mockResolvedValue("hashed-password"),
  verify: jest.fn().mockResolvedValue(true),
};

const mockOtpStrategy = {
  generate: jest.fn().mockResolvedValue("123456"),
  verify: jest.fn().mockResolvedValue({ userId: "usr_01" }),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSessionService = {
  create: jest.fn().mockResolvedValue({
    accessToken: "mock.access.token",
    refreshToken: "mock.refresh.token",
  }),
  revokeAllForUser: jest.fn().mockResolvedValue(undefined),
};

const mockCryptoService = {
  generateToken: jest.fn().mockResolvedValue({
    raw: "raw-token-abc123",
    hash: "hashed-token-abc123",
  }),
  sha256: jest.fn().mockResolvedValue("hashed-token-abc123"),
};

const mockRedisService = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendMagicLink: jest.fn().mockResolvedValue(undefined),
  sendOtp: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

// ── Factory ────────────────────────────────────────────────────────────────────

function makeService() {
  return new AuthService(
    mockPrisma as unknown as ConstructorParameters<typeof AuthService>[0],
    mockPasswordStrategy as unknown as ConstructorParameters<
      typeof AuthService
    >[1],
    mockOtpStrategy as unknown as ConstructorParameters<typeof AuthService>[2],
    mockAuditService as unknown as ConstructorParameters<typeof AuthService>[3],
    mockSessionService as unknown as ConstructorParameters<
      typeof AuthService
    >[4],
    mockCryptoService as unknown as ConstructorParameters<
      typeof AuthService
    >[5],
    mockRedisService as unknown as ConstructorParameters<typeof AuthService>[6],
    mockEmailService as unknown as ConstructorParameters<typeof AuthService>[7],
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const baseUser = {
  id: "usr_01",
  email: "test@example.com",
  emailVerified: true,
  name: "Test User",
  avatarUrl: null,
  role: "USER",
  suspended: false,
  deletedAt: null,
};

const baseAuthAccount = {
  id: "acc_01",
  provider: "password",
  providerId: null,
  credential: "$2b$12$hashedpassword",
  userId: "usr_01",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── signup ──────────────────────────────────────────────────────────────────

  describe("signup", () => {
    it("creates a new user, creates a session, stores verification token, and sends email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...baseUser,
        emailVerified: false,
      });

      const result = await service.signup(
        {
          email: "test@example.com",
          password: "StrongPass1!",
          name: "Test User",
        },
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(result.accessToken).toBe("mock.access.token");
      expect(result.refreshToken).toBe("mock.refresh.token");
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining("email:verify:"),
        expect.any(String),
        60 * 60 * 24,
      );
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.signup", userId: "usr_01" }),
      );
    });

    it("throws ValidationError if email is already taken", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(
        service.signup(
          {
            email: "test@example.com",
            password: "StrongPass1!",
            name: "Test",
          },
          "1.2.3.4",
          "Mozilla/5.0",
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe("login", () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        authAccounts: [baseAuthAccount],
      });
    });

    it("returns tokens and user on valid credentials", async () => {
      const result = await service.login(
        { email: "test@example.com", password: "StrongPass1!" },
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(result.accessToken).toBe("mock.access.token");
      expect(result.refreshToken).toBe("mock.refresh.token");
      expect(result.user.id).toBe("usr_01");
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.login" }),
      );
    });

    it("throws AuthError on wrong password", async () => {
      mockPasswordStrategy.verify.mockResolvedValueOnce(false);

      await expect(
        service.login(
          { email: "test@example.com", password: "WrongPass!" },
          "1.2.3.4",
          "",
        ),
      ).rejects.toThrow(AuthError);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth_login_failed" }),
      );
    });

    it("allows login even when email is not verified (current behavior)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        emailVerified: false,
        authAccounts: [baseAuthAccount],
      });

      const result = await service.login(
        { email: "test@example.com", password: "StrongPass1!" },
        "1.2.3.4",
        "",
      );

      expect(result.accessToken).toBe("mock.access.token");
    });

    it("throws if user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login(
          { email: "ghost@example.com", password: "AnyPass1!" },
          "1.2.3.4",
          "",
        ),
      ).rejects.toThrow(AuthError);
    });

    it("throws if user account is soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        authAccounts: [baseAuthAccount],
        deletedAt: new Date(),
      });

      await expect(
        service.login(
          { email: "test@example.com", password: "StrongPass1!" },
          "1.2.3.4",
          "",
        ),
      ).rejects.toThrow(AuthError);
    });

    it("throws if user has no password auth account", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        authAccounts: [],
      });

      await expect(
        service.login(
          { email: "test@example.com", password: "StrongPass1!" },
          "1.2.3.4",
          "Mozilla/5.0",
        ),
      ).rejects.toThrow(AuthError);
    });

    it("creates a session for valid login", async () => {
      await service.login(
        { email: "test@example.com", password: "StrongPass1!" },
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(mockSessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          ip: "1.2.3.4",
        }),
      );
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────────────────────

  describe("verifyEmail", () => {
    it("marks emailVerified=true and deletes Redis key", async () => {
      mockCryptoService.sha256.mockResolvedValueOnce("email-token-hash");
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ userId: "usr_01" }),
      );
      mockPrisma.user.update.mockResolvedValue({
        ...baseUser,
        emailVerified: true,
      });

      await service.verifyEmail("raw-token-abc123");

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_01" },
          data: { emailVerified: true },
        }),
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        "email:verify:email-token-hash",
      );
    });

    it("throws if token is not found in Redis (expired or invalid)", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.verifyEmail("bad-token")).rejects.toThrow(AuthError);
    });
  });

  // ── requestMagicLink ────────────────────────────────────────────────────────

  describe("requestMagicLink", () => {
    it("stores hashed token in Redis and sends email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await service.requestMagicLink(
        "test@example.com",
        "https://app.example.com/dashboard",
      );

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining("magic:token:"),
        expect.any(String),
        15 * 60,
      );
      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          token: "raw-token-abc123",
        }),
      );
    });

    it("returns 200 even if user does not exist (no enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Should resolve without throwing — caller gets 200 regardless
      await expect(
        service.requestMagicLink(
          "ghost@example.com",
          "https://app.example.com/",
        ),
      ).resolves.not.toThrow();

      expect(mockEmailService.sendMagicLink).not.toHaveBeenCalled();
    });

    it("does nothing for suspended users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        suspended: true,
      });

      await expect(
        service.requestMagicLink(
          "test@example.com",
          "https://app.example.com/",
        ),
      ).resolves.not.toThrow();

      expect(mockEmailService.sendMagicLink).not.toHaveBeenCalled();
    });
  });

  // ── consumeMagicLink ────────────────────────────────────────────────────────

  describe("consumeMagicLink", () => {
    it("creates a session and deletes the Redis key (single-use)", async () => {
      mockCryptoService.sha256.mockResolvedValueOnce("magic-hash");
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          userId: "usr_01",
          redirectUrl: "https://app.example.com/",
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.consumeMagicLink(
        "raw-token-abc123",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(result.accessToken).toBe("mock.access.token");
      expect(result.redirectUrl).toBe("https://app.example.com/");
      expect(mockRedisService.del).toHaveBeenCalledWith(
        "magic:token:magic-hash",
      );
    });

    it("throws if token is expired or already used", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.consumeMagicLink("stale-token", "1.2.3.4", ""),
      ).rejects.toThrow(AuthError);
    });
  });

  // ── requestOtp ──────────────────────────────────────────────────────────────

  describe("requestOtp", () => {
    it("generates OTP and sends email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await service.requestOtp("test@example.com");

      expect(mockOtpStrategy.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          email: "test@example.com",
        }),
      );
      expect(mockEmailService.sendOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com", code: "123456" }),
      );
    });

    it("does not send OTP for deleted users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await service.requestOtp("test@example.com");

      expect(mockEmailService.sendOtp).not.toHaveBeenCalled();
    });
  });

  // ── verifyOtp ───────────────────────────────────────────────────────────────

  describe("verifyOtp", () => {
    it("creates a session on correct code", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.verifyOtp(
        "test@example.com",
        "123456",
        "1.2.3.4",
        "Mozilla/5.0",
      );

      expect(result.user.id).toBe("usr_01");
      expect(result.accessToken).toBeDefined();
      expect(mockOtpStrategy.verify).toHaveBeenCalledWith(
        "test@example.com",
        "123456",
      );
    });

    it("throws if OTP strategy rejects", async () => {
      mockOtpStrategy.verify.mockRejectedValueOnce(
        new AuthError("INVALID_CREDENTIALS", "Invalid OTP"),
      );

      await expect(
        service.verifyOtp(
          "test@example.com",
          "000000",
          "1.2.3.4",
          "unknown-agent",
        ),
      ).rejects.toThrow(AuthError);
    });

    it("throws if OTP resolves to a missing user", async () => {
      mockOtpStrategy.verify.mockResolvedValueOnce({ userId: "missing_user" });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyOtp("test@example.com", "123456", "1.2.3.4", ""),
      ).rejects.toThrow(AuthError);
    });
  });

  // ── requestPasswordReset ────────────────────────────────────────────────────

  describe("requestPasswordReset", () => {
    it("stores hashed reset token and sends reset email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await service.requestPasswordReset("test@example.com");

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining("pwd:reset:"),
        expect.any(String),
        30 * 60,
      );
      expect(mockEmailService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "usr_01",
          email: "test@example.com",
          token: "raw-token-abc123",
        }),
      );
    });

    it("silently does nothing if user does not exist (no enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.requestPasswordReset("nobody@example.com"),
      ).resolves.not.toThrow();
      expect(mockEmailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("updates password hash and revokes all sessions", async () => {
      mockCryptoService.sha256.mockResolvedValueOnce("reset-hash");
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ userId: "usr_01" }),
      );
      mockPrisma.authAccount.updateMany.mockResolvedValue({ count: 1 });

      await service.resetPassword("raw-reset-token", "NewStrongPass1!");

      expect(mockPrisma.authAccount.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "usr_01", provider: "password" },
          data: { credential: "hashed-password" },
        }),
      );
      expect(mockSessionService.revokeAllForUser).toHaveBeenCalledWith(
        "usr_01",
      );
      expect(mockRedisService.del).toHaveBeenCalledWith("pwd:reset:reset-hash");
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.password_reset" }),
      );
    });

    it("throws if reset token is invalid or expired", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.resetPassword("stale-token", "NewPass1!"),
      ).rejects.toThrow(AuthError);
    });
  });
});
