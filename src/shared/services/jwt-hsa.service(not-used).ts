import { decodeJwt, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "@/config/env";
import { AuthError } from "../errors/AuthError";

interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
}

const ALGORITHM = "HS256";
const ACCESS_TTL = "15m";
const ISSUER = "relay";
const AUDIENCE = "relay:api";

// Use this for simple algorithm - HS256. This doesnt have private and public key and the keys are not stored as multiline in the env file
export class JwtService {
  private secret: Uint8Array;

  constructor() {
    const secretKey = env.JWT_PRIVATE_KEY;

    if (!secretKey || secretKey.length < 3) {
      throw new Error("JWT Secret is missing or too short");
    }

    this.secret = new TextEncoder().encode(secretKey);
  }

  async sign(
    payload: Omit<AccessTokenPayload, "iss" | "aud" | "iat" | "exp">,
  ): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
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
   * ! Only use for debugging
   */
  decode(token: string) {
    return decodeJwt(token);
  }
}
