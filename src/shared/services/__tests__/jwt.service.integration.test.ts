import { JwtService } from "../jwt.service";
import { env } from "@/config/env";

describe("JwtService Integration", () => {
  let jwtService: JwtService;

  beforeAll(() => {
    jwtService = new JwtService();
  });

  it("should sign and verify a token with default TTL", async () => {
    const payload = {
      sub: "user-123",
      email: "test@example.com",
      role: "user",
      sessionId: "session-123",
    };

    const token = await jwtService.sign(payload);
    expect(token).toBeDefined();

    const decoded = await jwtService.verify(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.sessionId).toBe(payload.sessionId);

    // Check that exp - iat is equal to JWT_ACCESS_TTL_SECONDS
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(env.JWT_ACCESS_TTL_SECONDS);
  });

  it("should respect dynamic JWT_ACCESS_TTL_SECONDS config changes", async () => {
    const originalTtl = env.JWT_ACCESS_TTL_SECONDS;
    const testTtl = 300; // 5 minutes

    try {
      // Temporarily change TTL config
      (env as { JWT_ACCESS_TTL_SECONDS: number }).JWT_ACCESS_TTL_SECONDS =
        testTtl;

      const payload = {
        sub: "user-123",
        email: "test@example.com",
        role: "user",
        sessionId: "session-123",
      };

      const token = await jwtService.sign(payload);
      const decoded = await jwtService.verify(token);

      expect(decoded.exp! - decoded.iat!).toBe(testTtl);
    } finally {
      // Restore original TTL
      (env as { JWT_ACCESS_TTL_SECONDS: number }).JWT_ACCESS_TTL_SECONDS =
        originalTtl;
    }
  });

  it("should throw AuthError for expired tokens", async () => {
    const originalTtl = env.JWT_ACCESS_TTL_SECONDS;

    try {
      // Set TTL to negative so it expires immediately
      (env as { JWT_ACCESS_TTL_SECONDS: number }).JWT_ACCESS_TTL_SECONDS = -10;

      const payload = {
        sub: "user-123",
        email: "test@example.com",
        role: "user",
        sessionId: "session-123",
      };

      const token = await jwtService.sign(payload);

      await expect(jwtService.verify(token)).rejects.toThrow(
        "Access token has expired",
      );
    } finally {
      (env as { JWT_ACCESS_TTL_SECONDS: number }).JWT_ACCESS_TTL_SECONDS =
        originalTtl;
    }
  });
});
