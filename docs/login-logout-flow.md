**Login**

1. Client calls `POST /api/v1/auth/login` in [auth.router.ts](E:\projects\relay\src\modules\auth\auth.router.ts:36).
2. Controller validates body in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:61).
3. `AuthService.login(...)` verifies email/password in [auth.service.ts](E:\projects\relay\src\modules\auth\auth.service.ts:106).
4. On success, it calls `SessionService.create(...)` in [auth.service.ts](E:\projects\relay\src\modules\auth\auth.service.ts:163).
5. `SessionService.create(...)`:
   - generates a raw refresh token and hash in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:46)
   - stores `refreshTokenHash` in Postgres `sessions` table in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:49)
   - stores `session:refresh:<hash> -> session.id` in Redis in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:60)
   - creates a short-lived access JWT in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:66)
6. Controller sets cookies with the raw tokens via `setAuthCookies(...)` in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:69) and [cookies.ts](E:\projects\relay\src\shared\utils\cookies.ts:11).

After login:

- Browser/client has:
  - `access_token` cookie = raw JWT
  - `refresh_token` cookie = raw refresh token
- Server has:
  - DB session row with `refreshTokenHash`
  - Redis key for reuse detection/rotation

**Refresh**

1. Client calls `POST /api/v1/auth/refresh` in [auth.router.ts](E:\projects\relay\src\modules\auth\auth.router.ts:42) and sends the `refresh_token` cookie.
2. Controller reads the refresh token cookie in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:107).
3. It calls `SessionService.rotateRefreshToken(...)` in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:117).
4. `rotateRefreshToken(...)`:
   - hashes the raw token in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:90)
   - checks Redis for `session:refresh:<hash>` in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:91)
   - checks DB for matching `refreshTokenHash` in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:93)
5. If valid:
   - generates a new raw refresh token + new hash in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:146)
   - updates the DB session row with the new hash in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:150)
   - deletes old Redis key and writes the new one in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:162)
   - signs a new access token in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:165)
6. Controller sets fresh cookies again in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:123).

After refresh:

- old refresh token should no longer be valid
- client now has a new `refresh_token`
- DB and Redis now point to the new hash

**Reuse Detection**
This is the security feature during refresh:

- if DB still has a session for that hash but Redis no longer has the key, the code treats that as reused/rotated token replay in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:98)
- then it revokes all sessions for that user in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:102)
- logs a critical audit event and sends a security alert email in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:104)

**Logout**

1. Client calls `POST /api/v1/auth/logout` in [auth.router.ts](E:\projects\relay\src\modules\auth\auth.router.ts:39).
2. Controller tries to read the refresh token cookie in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:87).
3. If it gets the raw refresh token, it calls `revokeByRefreshToken(...)` in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:90).
4. `revokeByRefreshToken(...)`:
   - hashes the raw token in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:186)
   - finds the session row by `refreshTokenHash` in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:187)
   - deletes that session row in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:192)
   - deletes the Redis key in [sessions.service.ts](E:\projects\relay\src\modules\sessions\sessions.service.ts:193)
5. Controller clears both cookies with `clearAuthCookies(...)` in [auth.controller.ts](E:\projects\relay\src\modules\auth\auth.controller.ts:93) and [cookies.ts](E:\projects\relay\src\shared\utils\cookies.ts:34).

After logout:

- client cookies are removed
- server-side session should be gone from DB + Redis

A compact mental model:

- access token = short-lived proof of identity
- refresh token = long-lived session handle
- DB stores hashed refresh token
- Redis tracks current valid refresh-token hash for rotation/reuse detection
- logout/delete session = destroy server-side session state + clear client cookie
