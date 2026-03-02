import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

/**
 * Handles password hashing and verification using bcrypt.
 * Cost factor >= 12 as per PRD security requirements.
 */
export class PasswordStrategy {
  /**
   * Hash a plain-text password.
   * Always generates a new salt — never reuse salts.
   */
  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, BCRYPT_COST);
  }

  /**
   * Compare a plain-text password against a stored bcrypt hash.
   * Safe to call with a dummy hash when the user does not exist —
   * bcrypt.compare still runs to prevent timing-based enumeration.
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
