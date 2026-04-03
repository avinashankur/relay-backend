import { PrismaClient, type User } from "../../generated/prisma/client.js";
import { ValidationError } from "@/shared/errors/ValidationError";
import { PasswordStrategy } from "./strategies/password.strategy.js";
import { AuditService } from "@/shared/services/audit.service.js";
import { AuthError } from "@/shared/errors/AuthError.js";
import { SessionService } from "../sessions/sessions.service.js";
import { CryptoService } from "@/shared/services/crypto.service.js";
import { RedisService } from "@/shared/services/redis.service.js";
import type { EmailService } from "@/shared/services/email.service.js";
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

const keys = {
  emailVerify: (hash: string) => `email:verify:${hash}`,
};

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordStrategy: PasswordStrategy,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
    private readonly cryptoService: CryptoService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

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

    return { user, accessToken, refreshToken };
  }
}
