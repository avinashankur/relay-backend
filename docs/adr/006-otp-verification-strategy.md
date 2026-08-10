# 006-ADR: OTP Verification Strategy

**Date:** -
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** auth, security, otp, redis

---

## Context

Relay supports One-Time Password (OTP) authentication, allowing users to log in by receiving a short numeric code (e.g., 6 digits) via email.

Because OTPs have a very low entropy compared to long cryptographic tokens (a 6-digit code only has 1,000,000 possible combinations), they are highly vulnerable to brute-force attacks. An attacker could theoretically guess the code by rapidly submitting verification requests.

We need a secure, performant mechanism to generate, store, and verify OTPs that explicitly prevents brute-force guessing, while also keeping our primary database (PostgreSQL) clean of short-lived, ephemeral data.

## Decision

We use **Redis-backed hashed OTPs with strict attempt locking**. The implementation lives in `src/modules/auth/strategies/otp.strategy.ts`.

1. **Generation & Storage:** The raw numeric OTP is generated securely but is _never stored in plain text_. We hash the code using SHA-256 and use it as part of a Redis key (`otp:${email}:${hash}`) storing the payload. We apply a strict 10-minute Time-To-Live (TTL).
2. **Brute Force Protection:** On every failed verification attempt, we increment an attempts counter in Redis (`otp:attempts:${email}`). If the user hits the maximum threshold (5 attempts), we set a lock key (`otp:locked:${email}`) for the remainder of the 10-minute window.
3. **Short-circuit Rejection:** If the lock key exists, the `verify` method immediately throws a `MAX_OTP_ATTEMPTS` error without even hashing the input or checking the primary OTP key, fully mitigating brute-force scripts.
4. **Consumption:** Upon successful verification, all related keys (the OTP itself, the attempts counter, and the lock) are atomically deleted to prevent replay attacks.

## Alternatives Considered

### Option A: Store OTPs in PostgreSQL

- **Description:** Create an `Otp` table with `code`, `expiresAt`, and `attempts` columns.
- **Pros:** Keeps all auth state in a single datastore.
- **Cons:** Generates massive amounts of database bloat. For every OTP requested, a row is inserted. Since they expire in 10 minutes, the database quickly fills with dead rows, requiring a background cleanup job to avoid performance degradation. Updating failure counters requires locking database rows.
- **Why we didn't choose it:** Redis is inherently designed for ephemeral data with automatic TTL expirations and atomic increments, making it far superior for this use case.

### Option B: Store Raw OTPs in Redis

- **Description:** Store the key as `otp:${email}` and the value as the raw `123456` code.
- **Pros:** Easier to debug locally.
- **Cons:** If a developer inadvertently dumps the Redis database, or if the cache is compromised, all active OTPs are exposed in plain text.
- **Why we didn't choose it:** While OTPs are short-lived, hashing them with SHA-256 provides a layer of defense-in-depth with virtually zero performance penalty.

## Consequences

### Positive

- **Security:** Brute-force attacks are mathematically impossible to execute against an account, as the attacker is locked out after 5 guesses.
- **Database Health:** PostgreSQL is spared from the heavy write/delete cycles of ephemeral OTP tokens.
- **Performance:** Verification, incrementing counters, and locking are all executed as sub-millisecond O(1) Redis operations.

### Negative

- **Redis Dependency:** OTP functionality relies entirely on Redis. If the Redis cluster goes down, the entire OTP login flow is unavailable (though password login would still function).
- **State Tied to Email:** Because the brute-force lock is tied to the email address (`otp:locked:${email}`), a malicious actor could intentionally lock out a legitimate user by requesting an OTP for their email and failing the verification 5 times. (Mitigated partially by rate-limiting the `/request-otp` endpoint).

## Follow-up Actions

- [ ] Ensure the `/api/v1/auth/otp/request` endpoint is strictly rate-limited by IP address to prevent attackers from spamming users' inboxes or intentionally locking their OTP verification windows.
