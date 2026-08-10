# 002-ADR: Opaque Refresh Tokens with Redis-Backed Rotation

**Date:** -
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** auth, security, sessions, tokens

---

## Context

Relay issues short-lived (15-minute) RS256 JWT access tokens for API authorization. To maintain long-lived user sessions without requiring constant re-authentication, we need a refresh token mechanism.

The primary security challenge with long-lived sessions is mitigating token theft. If an attacker intercepts a refresh token, they could theoretically maintain persistent access. We need a strategy that allows us to explicitly revoke sessions and actively detect when a refresh token has been compromised.

## Decision

We will use **opaque, cryptographically random strings** for refresh tokens, implementing a strict rotation and reuse-detection protocol using PostgreSQL and Redis.

1. **Format:** Refresh tokens will be opaque CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) strings, not JWTs.
2. **Delivery:** Delivered exclusively via an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to the `/api/v1/auth/refresh` path.
3. **Storage:** The raw token is never stored. A SHA-256 hash of the token is saved in PostgreSQL (`Session` table) and mirrored in Redis as a key.
4. **Rotation:** On every successful refresh request, the current token is invalidated and a brand new token is issued to the client. The PostgreSQL row is updated with the new hash, and the Redis key is atomically swapped.
5. **Reuse Detection:** If a client presents a refresh token whose hash exists in PostgreSQL (meaning it was a historically valid token) but does NOT exist in Redis (meaning it has already been rotated), we assume the token was stolen and replayed. In this event, we immediately revoke **all** active sessions for the compromised user and issue a security alert email.

## Alternatives Considered

### Option A: Sliding-Window JWTs

- **Description:** Issuing a long-lived JWT (e.g., 30 days) and continuously issuing new JWTs as the user remains active.
- **Pros:** Completely stateless. No database or Redis lookups required on refresh.
- **Cons:** JWTs cannot be explicitly revoked before their expiration time without maintaining a centralized "deny-list" (which defeats the purpose of being stateless). If a long-lived JWT is stolen, the attacker has guaranteed access until it expires.
- **Why we didn't choose it:** Fails our requirement for explicit, immediate session revocation and anomaly detection.

### Option B: Traditional Stateful Session IDs (e.g., Express-session)

- **Description:** A single opaque session ID cookie sent on every request, checked against a Redis store on every request.
- **Pros:** Very simple mental model. Highly secure. Immediate revocation.
- **Cons:** Requires a round-trip to Redis on _every single authenticated API request_, introducing latency and tying API scalability directly to Redis capacity.
- **Why we didn't choose it:** We want to optimize the "hot path" (authenticated API requests). By combining short-lived stateless JWTs with stateful refresh tokens, we only pay the database/Redis lookup cost once every 15 minutes instead of on every request.

## Consequences

### Positive

- **Security:** Token reuse detection provides a strong defense against hijacked sessions. Opaque tokens ensure no claims or user data are leaked if the token is intercepted.
- **Performance:** Database and cache lookups are strictly isolated to the `/refresh` endpoint. Standard API requests remain fast and stateless by validating the JWT signature locally.
- **Control:** Allows explicit session revocation (e.g., "Logout everywhere" or revoking a specific device).

### Negative

- **Complexity:** Managing the atomic state swap between the client cookie, PostgreSQL, and Redis during token rotation is complex.
- **Infrastructure Dependency:** The `/refresh` flow has a hard dependency on Redis availability. If Redis goes down, users cannot refresh their sessions (though their current 15-minute access tokens will continue to work until they expire).

## Follow-up Actions

- [ ] Ensure integration tests specifically cover the token reuse scenario (simulating a replay attack) to verify that all sessions are successfully revoked.
