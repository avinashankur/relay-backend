import { PrismaClient, type Session } from "@/generated/prisma/client";
import { AuthError } from "@/shared/errors/AuthError";
import { ForbiddenError } from "@/shared/errors/ForbiddenError";
import { AuditService } from "@/shared/services/audit.service";
import { CryptoService } from "@/shared/services/crypto.service";
import { EmailService } from "@/shared/services/email.service";
import { JwtService } from "@/shared/services/jwt.service";
import { RedisService } from "@/shared/services/redis.service";

const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const redisKey = (hash: string) => `session:refresh:${hash}`;

export interface CreateSessionInput {
  userId: string;
  ip: string;
  userAgent: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionListItem {
  id: string;
  deviceInfo: unknown;
  ip: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export class SessionService {
  private readonly jwtService: JwtService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {
    this.jwtService = new JwtService();
  }

  async create(input: CreateSessionInput): Promise<SessionTokens> {
    const { raw: refreshToken, hash } = this.cryptoService.generateToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: hash,
        ip: input.ip,
        deviceInfo: parseUserAgent(input.userAgent),
        expiresAt,
      },
    });

    // Store sessionId in Redis keyed by hash -- used for reuse detection on rotate
    await this.redisService.set(redisKey(hash), session.id, REFRESH_TTL_SEC);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
    });

    const accessToken = await this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return { accessToken, refreshToken };
  }

  // Rotate (refresh token rotation + reuse detection)
  /**
   * Consume the current refresh token and issue a new token pair.
   *
   * Reuse detection:
   *   If the hash is not in Redis but the session exists in DB,
   *   the token was already rotated -- indicating theft or replay.
   *   Response: revoke all user sessions + security alert email.
   */
  async rotateRefreshToken(
    rawToken: string,
    ip: string,
    userAgent: string,
  ): Promise<SessionTokens> {
    const hash = this.cryptoService.sha256(rawToken);
    const sessionId = await this.redisService.get(redisKey(hash));

    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });

    // Reuse detection: if session exists but hash is missing in Redis, it was already rotated
    if (!sessionId) {
      if (session) {
        // Token exists in DB but not Redis → already rotated → REUSE
        await this.revokeAllForUser(session.userId);

        await this.auditService.logCritical({
          action: "auth.token_reuse",
          userId: session.userId,
          ip,
          metadata: { sessionId: session.id },
        });

        await this.emailService.sendSecurityAlert({
          userId: session.userId,
          email: session.user.email,
          alertType: "token_reuse",
          userAgent,
          ip,
        });
      }
      throw new AuthError(
        "TOKEN_REUSE_DETECTED",
        "Token reuse detected. All sessions revoked.",
      );
    }

    if (!session) {
      await this.redisService.del(redisKey(hash));
      throw new AuthError("INVALID_TOKEN", "Session not found");
    }

    if (new Date() > session.expiresAt) {
      await this.redisService.del(redisKey(hash));
      throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired");
    }

    if (session.user.deletedAt) {
      throw new AuthError("ACCOUNT_DELETED", "This account has been deleted");
    }

    if (session.user.suspended) {
      throw new AuthError(
        "ACCOUNT_SUSPENDED",
        "This account has been suspended",
      );
    }

    const { raw: newRefreshToken, hash: newHash } =
      this.cryptoService.generateToken();
    const newExpiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        expiresAt: newExpiresAt,
        lastSeenAt: new Date(),
        ip,
        deviceInfo: parseUserAgent(userAgent),
      },
    });

    // Atomically swap Redis keys -- old key removed, new key set
    await this.redisService.del(redisKey(hash));
    await this.redisService.set(redisKey(newHash), session.id, REFRESH_TTL_SEC);

    const accessToken = await this.jwtService.sign({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    });

    await this.auditService.log({
      action: "auth.token_refresh",
      userId: session.userId,
      metadata: { sessionId: session.id },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revoke session
   * used by POST /auth/logout
   */
  async revokeByRefreshToken(rawToken: string): Promise<void> {
    const hash = this.cryptoService.sha256(rawToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash },
    });
    if (!session) return; // already gone -- no-op

    await this.prisma.session.delete({ where: { id: session.id } });
    await this.redisService.del(redisKey(hash));

    await this.auditService.log({
      action: "session.revoked",
      userId: session.userId,
      metadata: { sessionId: session.id, revokedBy: "user" },
    });
  }

  /**
   * Revoke a specific session by ID, verifying the requesting user owns it.
   * Used by DELETE /sessions/:id.
   */
  async revokeById(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AuthError("INVALID_TOKEN", "Session not found");
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        "RESOURCE_FORBIDDEN",
        "You do not own this session",
      );
    }

    await this.prisma.session.delete({ where: { id: sessionId } });
    await this.redisService.del(redisKey(session.refreshTokenHash));

    await this.auditService.log({
      action: "session.revoked",
      userId,
      metadata: { sessionId, revokedBy: "user" },
    });
  }

  /**
   * Revoke all sessions for a user.
   * Used by: password reset, token reuse detection, admin suspend.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
    });

    await this.prisma.session.deleteMany({
      where: { userId },
    });

    await Promise.all(
      sessions.map((s: Session) =>
        this.redisService.del(redisKey(s.refreshTokenHash)),
      ),
    );

    await this.auditService.log({
      action: "session.revoked_all",
      userId,
      metadata: { count: sessions.length },
    });
  }

  /**
   * List all active (non-expired) sessions for a user.
   * Used by GET /sessions.
   */
  async listAllForUser(userId: string): Promise<SessionListItem[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        deviceInfo: true,
        ip: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }
}

/**
 * Minimal User-Agent parser.
 * Replace with `ua-parser-js` or similar if richer device info is needed.
 */
function parseUserAgent(ua: string): object {
  return { ua };
}
