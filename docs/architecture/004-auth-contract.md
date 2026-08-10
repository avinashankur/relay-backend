# Relay Auth API Contract

> **Canonical reference for `/api/v1/auth/*` endpoints.**
> Derived directly from live source in `src/modules/auth/`. Update this file
> whenever the router, controller, or cookie utility changes.

---

## Global Conventions

### Base path

All auth routes are mounted at `/api/v1/auth/`.

### Request format

Every `POST` endpoint (except `/refresh` and `/logout`) requires:

```
Content-Type: application/json
```

`requireJsonBody` middleware enforces this and rejects requests that omit it.
`GET` endpoints use query parameters only — no body.

### Response envelope

All responses (success and error) use the shared envelope:

```jsonc
// Success
{ "success": true, "data": <payload> }

// Error
{ "success": false, "error": { "code": "<CODE>", "message": "<human string>" } }

// Validation error (422)
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": [...] } }
```

### Cookie model

Two HTTP-only cookies are used for browser sessions.

| Cookie          | Value             | Path (production)       | Path (dev) | SameSite (prod) | SameSite (dev) | Secure | MaxAge                         |
| --------------- | ----------------- | ----------------------- | ---------- | --------------- | -------------- | ------ | ------------------------------ |
| `access_token`  | RS256 JWT         | `/`                     | `/`        | `Strict`        | `Lax`          | `true` | `JWT_ACCESS_TTL_SECONDS` (ms)  |
| `refresh_token` | opaque random hex | `/api/v1/auth/refresh`¹ | `/`        | `Strict`        | `Lax`          | `true` | `JWT_REFRESH_TTL_SECONDS` (ms) |

**Dev defaults** (env `NODE_ENV != production`):

- `Secure: false` — works over plain HTTP.
- `SameSite: Lax` — allows cross-origin redirects (magic link callback).
- `domain: localhost` — shared across ports on localhost.
- `path: /` for both cookies — simplifies local debugging.

### JWT access token claims

```jsonc
{
  "iss": "relay",
  "aud": "relay:api",
  "sub": "<userId>",
  "email": "<user email>",
  "role": "user" | "admin",
  "sessionId": "<sessionId>",
  "iat": <unix>,
  "exp": <unix>   // iat + JWT_ACCESS_TTL_SECONDS
}
```

Algorithm: **RS256**. The `exp` is determined by `JWT_ACCESS_TTL_SECONDS` (which also controls the cookie `maxAge`).

### Refresh token format

Opaque cryptographically random hex string. Never returned in a response body —
only ever delivered via the `refresh_token` cookie. Stored as a SHA-256 hash in
Postgres (`Session.refreshTokenHash`) and mirrored in Redis for reuse detection.

### Token resolution for protected routes

`parseToken` middleware resolves the access token in this priority order:

1. `access_token` cookie (browser clients — takes precedence).
2. `Authorization: Bearer <token>` header (API / non-browser clients).

On failure the middleware calls `next()` silently. `requireAuth` enforces the
401 if the route actually needs authentication.

---

## Endpoint Reference

---

### `POST /api/v1/auth/signup`

Create a new user account. Sends a verification email immediately.

**Rate limit:** 5 requests / 60 min / IP.

**Request body:**

```jsonc
{
  "email": "string (valid email, lowercased)",
  "password": "string (8–128 chars)",
  "name": "string (1–100 chars)",
}
```

**Success — `201`:**

```jsonc
{
  "success": true,
  "data": {
    "accessToken": "<JWT string>",
    "refreshToken": "<opaque hex>",
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "avatarUrl": "string | null",
      "role": "user",
      "emailVerified": false,
    },
  },
}
```

**Cookies set:** `access_token` + `refresh_token` (see global cookie model).

**Side effects:**

- Creates `User` + `AuthAccount(provider=password)` rows in Postgres.
- Creates a `Session` row; stores `sessionId → refreshTokenHash` in Redis.
- Enqueues a verification email (token stored in Redis, TTL 24 h).
- Logs `auth.signup` audit event.

**Error cases:**

| HTTP | Code               | Condition                |
| ---- | ------------------ | ------------------------ |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields   |
| 400  | `EMAIL_TAKEN`      | Email already registered |

---

### `POST /api/v1/auth/login`

Authenticate with email + password. Unverified emails are currently allowed
(verification gate is commented out pending policy decision — see `auth.service.ts`).

**Rate limit:** 5 requests / 15 min / IP.

**Request body:**

```jsonc
{
  "email": "string",
  "password": "string (non-empty)",
}
```

**Success — `200`:**

```jsonc
{
  "success": true,
  "data": {
    "accessToken": "<JWT string>",
    "refreshToken": "<opaque hex>",
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "avatarUrl": "string | null",
      "role": "user" | "admin",
      "emailVerified": true | false
    }
  }
}
```

**Cookies set:** `access_token` + `refresh_token`.

**Side effects:**

- Creates a new `Session` row; Redis entry for reuse detection.
- Logs `auth.login` audit event with `method: "password"`.
- Failed attempts log `auth_login_failed` with reason.

**Security note:** Password verification runs even for unknown emails (constant-time
path) to prevent timing-based user enumeration.

**Error cases:**

| HTTP | Code                  | Condition                                           |
| ---- | --------------------- | --------------------------------------------------- |
| 422  | `VALIDATION_ERROR`    | Missing/invalid fields                              |
| 401  | `INVALID_CREDENTIALS` | Wrong email, wrong password, or no password account |
| 401  | `ACCOUNT_DELETED`     | Soft-deleted account                                |

---

### `POST /api/v1/auth/logout`

Revoke the current session. Token is optional — if no cookie is present, cookies
are still cleared and a success response is returned (idempotent logout).

**Rate limit:** None.

**Auth:** `parseToken` runs (optional — populates `req.user` if token valid) but
`requireAuth` is **not** applied. Session revocation is driven by the
`refresh_token` cookie value, not the access token.

**Request body:** None required.

**Success — `200`:**

```jsonc
{ "success": true, "data": { "message": "Logged out successfully" } }
```

**Cookies cleared:** `access_token` + `refresh_token` (both set to expired).

**Side effects:**

- Deletes `Session` row and removes Redis key for the presented refresh token.
- Logs `session.revoked` audit event.
- If no `refresh_token` cookie is present: cookies are still cleared, no DB
  operation occurs, response is still `200`.

**Error cases:** None (always succeeds from the client's perspective).

---

### `POST /api/v1/auth/refresh`

Exchange the current `refresh_token` cookie for a fresh token pair (rotation).

**Rate limit:** None.

**Auth:** No middleware — reads `refresh_token` cookie directly.

**Request body:** None. The refresh token is read exclusively from the
`refresh_token` cookie. There is no body parameter fallback.

**Success — `200`:**

```jsonc
{ "success": true, "data": "Token refreshed successfully" }
```

**Cookies set:** New `access_token` + new `refresh_token` (old pair invalidated).

**Side effects:**

- Updates `Session` row: new `refreshTokenHash`, extended `expiresAt`, updated
  `lastSeenAt`, `ip`, and `deviceInfo`.
- Atomically swaps Redis keys: old hash deleted, new hash inserted.
- Logs `auth.token_refresh` audit event.
- **Reuse detected** (token in DB but not in Redis): revokes ALL user sessions,
  logs `auth.token_reuse` critical audit event, sends a security-alert email.

**Error cases:**

| HTTP | Code                    | Condition                              |
| ---- | ----------------------- | -------------------------------------- |
| 401  | `MISSING_REFRESH_TOKEN` | `refresh_token` cookie absent or empty |
| 401  | `TOKEN_REUSE_DETECTED`  | Token already rotated (possible theft) |
| 401  | `INVALID_TOKEN`         | Session not found in DB                |
| 401  | `TOKEN_EXPIRED`         | Refresh token past its 30-day TTL      |
| 401  | `ACCOUNT_DELETED`       | Associated user soft-deleted           |
| 401  | `ACCOUNT_SUSPENDED`     | User suspended by admin                |

---

### `POST /api/v1/auth/magic-link/request`

Send a magic-link login email. Always returns `200` regardless of whether the
email exists (prevents enumeration).

**Rate limit:** 3 requests / 10 min / IP (shared `email-send` limiter).

**Request body:**

```jsonc
{
  "email": "string",
  "redirectUrl": "string (default: \"/\")",
}
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects (when email matches an active, non-suspended user):**

- Generates a one-time token; stores `{ userId, redirectUrl }` in Redis, TTL 15 min.
- Enqueues magic-link email.

**Error cases:**

| HTTP | Code               | Condition              |
| ---- | ------------------ | ---------------------- |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields |

---

### `GET /api/v1/auth/magic-link/callback?token=<raw>`

Consume a magic-link token and establish a session. Issues a `302` redirect on
success — **not** a JSON response.

**Rate limit:** None.

**Request:** Query parameter `token` (string, required). No body.

**Success — `302 Redirect`:**
Redirects to the `redirectUrl` stored with the token. No JSON body.

**Cookies set:** `access_token` + `refresh_token` (set before the redirect).

**Side effects:**

- Deletes Redis key immediately (single-use).
- If user's email is unverified, sets `emailVerified = true`.
- Creates a new `Session` row; Redis entry for reuse detection.
- Logs `auth.login` audit event with `method: "magic_link"`.

**Error cases:**

| HTTP | Code                  | Condition                                    |
| ---- | --------------------- | -------------------------------------------- |
| 422  | `VALIDATION_ERROR`    | `token` query param missing                  |
| 401  | `INVALID_TOKEN`       | Token not in Redis (expired or already used) |
| 401  | `INVALID_CREDENTIALS` | Associated user deleted                      |

---

### `POST /api/v1/auth/otp/request`

Send a one-time passcode email. Always returns `200` (prevents enumeration).

**Rate limit:** 3 requests / 10 min / IP (shared `email-send` limiter).

**Request body:**

```jsonc
{ "email": "string" }
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects (when email matches an active user):**

- Generates a numeric OTP; stores it in Redis with bounded attempt counter.
- Enqueues OTP email.

**Error cases:**

| HTTP | Code               | Condition              |
| ---- | ------------------ | ---------------------- |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields |

---

### `POST /api/v1/auth/otp/verify`

Verify a one-time passcode and establish a session.

**Rate limit:** 5 requests / 10 min / IP (`otp-verify` limiter).

**Request body:**

```jsonc
{
  "email": "string",
  "code": "string",
}
```

**Success — `200`:**

```jsonc
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "avatarUrl": "string | null",
      "role": "user" | "admin",
      "emailVerified": true
    }
  }
}
```

**Cookies set:** `access_token` + `refresh_token`.

**Side effects:**

- If user's email is unverified, sets `emailVerified = true`.
- Creates a new `Session` row; Redis entry for reuse detection.
- Logs `auth.login` audit event with `method: "otp"`.

**Error cases:**

| HTTP | Code                  | Condition                                  |
| ---- | --------------------- | ------------------------------------------ |
| 422  | `VALIDATION_ERROR`    | Missing/invalid fields                     |
| 401  | `INVALID_CREDENTIALS` | Wrong code, or account deleted             |
| 401  | `ACCOUNT_SUSPENDED`   | User suspended                             |
| 401  | `MAX_OTP_ATTEMPTS`    | Attempt limit reached; re-request required |

---

### `POST /api/v1/auth/password-reset/request`

Request a password reset email. Always returns `200` (prevents enumeration).

**Rate limit:** 3 requests / 10 min / IP (shared `email-send` limiter).

**Request body:**

```jsonc
{ "email": "string" }
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects (when email matches an active user):**

- Generates a one-time reset token; stores `{ userId }` in Redis, TTL 30 min.
- Enqueues password-reset email.

**Error cases:**

| HTTP | Code               | Condition              |
| ---- | ------------------ | ---------------------- |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields |

---

### `POST /api/v1/auth/password-reset`

Apply a new password using a reset token. Revokes all active sessions.

**Rate limit:** None.

**Request body:**

```jsonc
{
  "token": "string",
  "newPassword": "string (8–128 chars)",
}
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None (all sessions revoked; client must log in again).

**Side effects:**

- Deletes Redis key immediately (single-use).
- Updates `AuthAccount.credential` with the new bcrypt hash.
- Revokes **all** sessions for the user (Postgres delete + Redis cleanup).
- Logs `auth.password_reset` audit event.

**Error cases:**

| HTTP | Code               | Condition                                    |
| ---- | ------------------ | -------------------------------------------- |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields                       |
| 401  | `INVALID_TOKEN`    | Token not in Redis (expired or already used) |

---

### `POST /api/v1/auth/verify-email`

Mark a user's email as verified using the token from the verification email.

**Rate limit:** None.

**Request body:**

```jsonc
{ "token": "string" }
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects:**

- Deletes Redis key immediately (single-use).
- Sets `User.emailVerified = true`.
- Logs `auth.email_verified` audit event.

**Error cases:**

| HTTP | Code               | Condition                                    |
| ---- | ------------------ | -------------------------------------------- |
| 422  | `VALIDATION_ERROR` | `token` missing                              |
| 401  | `INVALID_TOKEN`    | Token not in Redis (expired or already used) |

---

### `GET /api/v1/auth/verify-email?token=<raw>`

Clickable verification-email callback. Performs the same verification side
effects as `POST /api/v1/auth/verify-email`, but reads the token from the query
string so the email CTA can be opened directly from an inbox.

**Rate limit:** None.

**Request:** Query parameter `token` (string, required). No body.

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects:**

- Deletes Redis key immediately (single-use).
- Sets `User.emailVerified = true`.
- Logs `auth.email_verified` audit event.

**Error cases:**

| HTTP | Code               | Condition                                    |
| ---- | ------------------ | -------------------------------------------- |
| 422  | `VALIDATION_ERROR` | `token` query param missing                  |
| 401  | `INVALID_TOKEN`    | Token not in Redis (expired or already used) |

---

### `POST /api/v1/auth/resend-verification`

Resend the verification email. Always returns `200` (prevents enumeration).
Silently no-ops for unknown addresses, deleted/suspended accounts, and already-verified users.

**Rate limit:** 3 requests / 10 min / IP (shared `email-send` limiter).

**Request body:**

```jsonc
{ "email": "string" }
```

**Success — `200`:**

```jsonc
{ "success": true, "data": null }
```

**Cookies set:** None.

**Side effects (when email matches an unverified, active user):**

- Generates a new verification token; overwrites any existing Redis entry, TTL 24 h.
- Enqueues verification email.
- Logs `auth.verification_email_resent` audit event.

**Error cases:**

| HTTP | Code               | Condition              |
| ---- | ------------------ | ---------------------- |
| 422  | `VALIDATION_ERROR` | Missing/invalid fields |

---

## Rate Limit Error Response

When a rate limit is exceeded the response is `429` with no envelope:

```
HTTP 429 Too Many Requests
Retry-After: <seconds>
```

---

## Known Issues / Deferred Behaviour

| Ref                      | Description                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.service.ts:156`    | Email-verification gate at login is commented out. Unverified users can log in.                                                                                     |
| `auth.controller.ts:168` | Magic-link callback has a commented-out JSON response alternative. Current behaviour is always a `302` redirect. (Commented code can be removed without any issue.) |

---

## Redis Key Reference

| Key pattern                | TTL     | Content                   |
| -------------------------- | ------- | ------------------------- |
| `email:verify:<sha256>`    | 24 h    | `{ userId }`              |
| `magic:token:<sha256>`     | 15 min  | `{ userId, redirectUrl }` |
| `pwd:reset:<sha256>`       | 30 min  | `{ userId }`              |
| `session:refresh:<sha256>` | 30 days | `<sessionId>` string      |
| `rl:login:<ip>`            | 15 min  | sliding counter           |
| `rl:signup:<ip>`           | 60 min  | sliding counter           |
| `rl:email-send:<ip>`       | 10 min  | sliding counter           |
| `rl:otp-verify:<ip>`       | 10 min  | sliding counter           |
