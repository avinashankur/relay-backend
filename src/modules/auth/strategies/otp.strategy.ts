import { RedisService } from "@/shared/services/redis.service";
import { CryptoService } from "@/shared/services/crypto.service";
import { AuthError } from "@/shared/errors/AuthError";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

const otpKey = (email: string, hash: string) => `otp:${email}:${hash}`;
const otpAttemptsKey = (email: string) => `otp:attempts:${email}`;
const otpLockedKey = (email: string) => `otp:locked:${email}`;

export interface OtpPayload {
  userId: string;
  email: string;
}

export class OtpStrategy {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly redis: RedisService,
  ) {}

  async generate(payload: OtpPayload): Promise<string> {
    const locked = await this.redis.get(otpLockedKey(payload.email));
    if (locked) {
      throw new AuthError(
        "MAX_OTP_ATTEMPTS",
        "Too many attempts. Please request a new code.",
      );
    }

    const code = this.cryptoService.generateOtpCode();
    const hash = this.cryptoService.sha256(code);

    await this.redis.setJson(
      otpKey(payload.email, hash),
      payload,
      OTP_TTL_SECONDS,
    );

    return code;
  }

  async verify(email: string, code: string): Promise<OtpPayload> {
    const locked = await this.redis.get(otpLockedKey(email));
    if (locked) {
      throw new AuthError(
        "MAX_OTP_ATTEMPTS",
        "Too many attempts. Please request a new code.",
      );
    }

    const hash = this.cryptoService.sha256(code);
    const payload = await this.redis.getJson<OtpPayload>(otpKey(email, hash));

    if (!payload) {
      const attempts = await this.redis.increment(otpAttemptsKey(email));

      if (attempts === 1) {
        await this.redis.expire(otpAttemptsKey(email), OTP_TTL_SECONDS);
      }

      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.redis.set(otpLockedKey(email), "1", OTP_TTL_SECONDS);
        await this.redis.del(otpAttemptsKey(email));
        throw new AuthError(
          "MAX_OTP_ATTEMPTS",
          "Too many incorrect attempts. Please request a new code.",
        );
      }

      throw new AuthError(
        "INVALID_CREDENTIALS",
        `Invalid or expired code. ${OTP_MAX_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    // Valid — consume all keys
    await this.redis.del(
      otpKey(email, hash),
      otpAttemptsKey(email),
      otpLockedKey(email),
    );

    return payload;
  }
}
