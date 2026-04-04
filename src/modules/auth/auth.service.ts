import { PrismaClient, type User } from "../../generated/prisma/client.js";
import { ValidationError } from "@/shared/errors/ValidationError";
import { PasswordStrategy } from "./strategies/password.strategy.js";
import { AuditService } from "@/shared/services/audit.service.js";
import { AuthError } from "@/shared/errors/AuthError.js";
import { SessionService } from "../sessions/sessions.service.js";
import { CryptoService } from "@/shared/services/crypto.service.js";
import { RedisService } from "@/shared/services/redis.service.js";
import { EmailService } from "@/shared/services/email.service.js";
import { OtpStrategy } from "./strategies/otp.strategy.js";
import type { LoginInput, SignupInput } from "./auth.validators";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: Pick<
    User,
    "id" | "email" | "name" | "avatarUrl" | "role" | "emailVerified"
  >;
}

// Constants
const TTL_EMAIL_VERIFY = 60 * 60 * 24; // 24 hours
const TTL_MAGIC_LINK = 60 * 15; // 15 min
const TTL_PASSWORD_RESET = 60 * 30; // 30 min

const keys = {
  emailVerify: (hash: string) => `email:verify:${hash}`,
  magicLink: (hash: string) => `magic:token:${hash}`,
  passwordReset: (hash: string) => `pwd:reset:${hash}`,
};

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordStrategy: PasswordStrategy,
    private readonly otpStrategy: OtpStrategy,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
    private readonly cryptoService: CryptoService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  // SIGNUP SERVICE
  async signup(
    input: SignupInput,
    ip: string,
    userAgent: string,
  ): Promise<AuthResult> {
    // check if the email already exists in our db
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ValidationError(
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    }

    // otherwise hash the password first and store the user in db
    const credentialHash = await this.passwordStrategy.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        authAccounts: {
          create: {
            provider: "password",
            credential: credentialHash,
          },
        },
      },
    });

    const { accessToken, refreshToken } = await this.sessionService.create({
      userId: user.id,
      ip,
      userAgent,
    });

    const { raw, hash } = await this.cryptoService.generateToken();
    await this.redisService.set(
      keys.emailVerify(hash),
      JSON.stringify({ userId: user.id }),
      TTL_EMAIL_VERIFY,
    );

    await this.emailService.sendVerificationEmail({
      userId: user.id,
      token: raw,
      email: user.email,
    });
    await this.auditService.log({ action: "auth.signup", userId: user.id });

    return { user, accessToken, refreshToken };
  }

  // LOGIN SERVICE
  async login(
    input: LoginInput,
    ip: string,
    userAgent: string,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email,
      },
      include: {
        authAccounts: {
          where: {
            provider: "password",
          },
        },
      },
    });

    // Constant-time path: always attempt bcrypt compare to prevent timing attacks
    // The password verification happens before the if (!user) check to prevent timing attacks during authentication.
    const account = user?.authAccounts[0];
    const credentialHash =
      account?.credential ??
      "$2b$12$invalidhashpadding000000000000000000000000000000000000000";

    const isValid = await this.passwordStrategy.verify(
      input.password,
      credentialHash,
    );

    if (!user || !account || !isValid) {
      await this.auditService.log({
        action: "auth_login_failed",
        ip,
        metadata: {
          reason: !user
            ? "user_not_found"
            : !isValid
              ? "wrong_password"
              : "no_password_account",
        },
      });

      throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
    }

    if (user.deletedAt) {
      throw new AuthError("ACCOUNT_DELETED", "This account has been deleted");
    }

    // if (!user.emailVerified) {
    //   throw new AuthError(
    //     "EMAIL_NOT_VERIFIED",
    //     "Please verify your email before logging in",
    //   );
    // }

    const { accessToken, refreshToken } = await this.sessionService.create({
      userId: user.id,
      ip,
      userAgent,
    });

    await this.auditService.log({
      action: "auth.login",
      userId: user.id,
      ip,
      metadata: { method: "password" },
    });

    return { user: this.sanitizeUser(user), accessToken, refreshToken };
  }

  // SEND MAGIC LINK
  async requestMagicLink(email: string, redirectUrl: string): Promise<void> {
    // Always resolve, no enumeration

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.suspended) return;

    const { raw, hash } = await this.cryptoService.generateToken();

    console.log("[DEBUG] Storing magic link with redirectUrl:", redirectUrl);

    await this.redisService.set(
      keys.magicLink(hash),
      JSON.stringify({ userId: user.id, redirectUrl: redirectUrl ?? "/" }),
      TTL_MAGIC_LINK,
    );

    await this.emailService.sendMagicLink({
      email: user.email,
      token: raw,
    });
  }

  // CONSUME MAGIC LINK
  async consumeMagicLink(rawToken: string, ip: string, userAgent: string) {
    const hash = await this.cryptoService.sha256(rawToken);

    const redisKey = keys.magicLink(hash);
    const stored = await this.redisService.get(redisKey);

    if (!stored) {
      throw new AuthError(
        "INVALID_TOKEN",
        "Magic link is invalid or has expired",
      );
    }

    // Single-use: delete immediately before creating session
    await this.redisService.del(redisKey);

    const { userId, redirectUrl } = JSON.parse(stored) as {
      userId: string;
      redirectUrl: string;
    };

    console.log("[DEBUG] Consuming magic link with redirectUrl:", redirectUrl);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Associated account no longer exists",
      );
    }

    // Auto-verify email if not already verified
    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const { accessToken, refreshToken } = await this.sessionService.create({
      userId: user.id,
      ip,
      userAgent,
    });

    await this.auditService.log({
      action: "auth.login",
      userId: user.id,
      ip,
      metadata: { method: "magic_link" },
    });

    return { accessToken, refreshToken, redirectUrl };
  }

  // REQUEST OTP SERVICE
  async requestOtp(email: string): Promise<void> {
    // Always resolve, no enumeratoin

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.suspended) return;

    const code = await this.otpStrategy.generate({ userId: user.id, email });

    await this.emailService.sendOtp({
      email: user.email,
      code,
    });
  }

  // VERIFY OTP SERVICE
  async verifyOtp(
    email: string,
    code: string,
    ip: string,
    userAgent: string,
  ): Promise<AuthResult> {
    const payload = await this.otpStrategy.verify(email, code);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.deletedAt) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Associated account no longer exists",
      );
    }

    if (user.suspended) {
      throw new AuthError(
        "ACCOUNT_SUSPENDED",
        "This account has been suspended",
      );
    }

    // Auto-verify email on successful OTP
    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const { accessToken, refreshToken } = await this.sessionService.create({
      userId: user.id,
      ip,
      userAgent,
    });

    await this.auditService.log({
      action: "auth.login",
      userId: user.id,
      ip,
      metadata: { method: "otp" },
    });

    return { user: this.sanitizeUser(user), accessToken, refreshToken };
  }

  // PASSWORD RESET REQUEST SERVICE
  async requestPasswordReset(email: string): Promise<void> {
    // Always resolve, no enumeration

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;

    const { raw, hash } = await this.cryptoService.generateToken();
    await this.redisService.set(
      keys.passwordReset(hash),
      JSON.stringify({ userId: user.id }),
      TTL_PASSWORD_RESET,
    );

    await this.emailService.sendPasswordReset({
      userId: user.id,
      email,
      token: raw,
    });
  }

  // RESET PASSWORD
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hash = await this.cryptoService.sha256(rawToken);
    const redisKey = keys.passwordReset(hash);

    const stored = await this.redisService.get(redisKey);
    if (!stored) {
      throw new AuthError(
        "INVALID_TOKEN",
        "Password reset link is invalid or has expired",
      );
    }

    await this.redisService.del(redisKey);

    const { userId } = JSON.parse(stored) as { userId: string };
    const credentialHash = await this.passwordStrategy.hash(newPassword);

    await this.prisma.authAccount.updateMany({
      where: { userId, provider: "password" },
      data: { credential: credentialHash },
    });

    // Revoke all active sessions
    await this.sessionService.revokeAllForUser(userId);

    await this.auditService.log({ action: "auth.password_reset", userId });
  }

  // EMAIL VERIFICATION
  async verifyEmail(rawToken: string): Promise<void> {
    const hash = await this.cryptoService.sha256(rawToken);
    const redisKey = keys.emailVerify(hash);

    const stored = await this.redisService.get(redisKey);
    if (!stored) {
      throw new AuthError(
        "INVALID_TOKEN",
        "Verification link is invalid or has expired",
      );
    }

    await this.redisService.del(redisKey);

    const { userId } = JSON.parse(stored) as { userId: string };

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    await this.auditService.log({ action: "auth.email_verified" });
  }

  // HELPERS
  private sanitizeUser(
    user: User,
  ): Pick<
    User,
    "id" | "email" | "name" | "avatarUrl" | "role" | "emailVerified"
  > {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }
}
