import { env } from "@/config/env";
import { SignJWT, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { AuthError } from "../errors/AuthError";

// constants
const ALGORITHM = "RS256"; // not symmetric like HS256
const ISSUER = "identitycore";
const AUDIENCE = "identitycore:api";
const ACCESS_TTL = "15m";

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // userId
  email: string;
  role: string;
  sessionId: string;
}

/**
 * JWT service using RS256 (asymmetric) signing.
 * Keys are loaded from AWS Secrets Manager via config at startup.
 */
export class JwtService {
  private privateKey!: CryptoKey;
  private publicKey!: CryptoKey;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.loadKeys();
  }

  // since RSA keys are not symmetric and are multiline, this causes issues when stored as env vars -- we need to convert them from PEM format to CryptoKey objects
  private async loadKeys() {
    const privateKeyPem = env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n");
    const publicKeyPem = env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");

    this.privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(privateKeyPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

    this.publicKey = await crypto.subtle.importKey(
      "spki",
      pemToDer(publicKeyPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }

  /**
   * Sign a new access token for the given user/session.
   * TTL is fixed at 15 minutes
   */
  async sign(
    payload: Omit<AccessTokenPayload, "iss" | "aud" | "exp">,
  ): Promise<string> {
    await this.ready; // ensure keys are loaded

    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.privateKey);
  }

  /**
   * Verify a JWT and return its typed payload.
   * Throws AuthError for expired, malformed, or invalid tokens.
   */
  async verify(token: string): Promise<AccessTokenPayload> {
    await this.ready; // ensure keys are loaded

    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: [ALGORITHM],
      });

      return payload as AccessTokenPayload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("expired")) {
        throw new AuthError("TOKEN_EXPIRED", "Access token has expired");
      }
      throw new AuthError("INVALID_TOKEN", "Access token is invalid");
    }
  }

  /**
   * Decode a JWT without verifying the signature.
   * Use only in non-security-sensitive contexts (e.g. logging, debugging).
   */
  decode(token: string): JWTPayload {
    return decodeJwt(token);
  }
}

// PEM → DER conversion
function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "")
    .trim();

  // Decode Base64 to binary
  const binary = atob(base64);

  // Convert to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}
