import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

const TOKEN_BYTES = 32; // 256 bits -> 64-char hex string
const OTP_LENGTH = 6;

export class CryptoService {
  // Token Generations
  /**
   * Generate a cryptographically secure random hex token.
   * Returns both the raw token (for the recipient) and its SHA-256 hash
   * (for storage) -- so callers never accidentally store the raw value.
   *
   * Used for: magic links, password reset tokens, email verification tokens.
   */
  generateToken(): { raw: string; hash: string } {
    const raw = randomBytes(TOKEN_BYTES).toString("hex");
    const hash = this.sha256(raw);
    return { raw, hash };
  }

  /**
   * Generate a cryptographically secure zero-padded numeric OTP code.
   * Uses crypto.randomInt for an unbiased distribution within [0, 1_000_000).
   *
   * Used for: email OTP codes.
   */
  generateOtpCode(length: number = OTP_LENGTH): string {
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, "0");
  }

  // Hashing
  sha256(input: string): string {
    return createHash("sha256").update(input, "utf-8").digest("hex");
  }

  // Comparison
  /**
   * Timing-safe string comparison.
   * Prevents timing attacks when comparing tokens or hashes.
   *
   * Returns false (rather than throwing) when strings have different lengths,
   * since a length mismatch is itself a safe early-exit -- the attacker gains
   * no byte-by-byte timing information from it.
   *
   * Used for: OTP code verification in OtpStrategy.
   */
  timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return timingSafeEqual(bufA, bufB);
  }
}
