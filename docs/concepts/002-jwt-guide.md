# JSON Web Tokens (JWT) — Comprehensive Guide

## What is a JWT?

A **JSON Web Token (JWT)** is an open standard ([RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)) for securely transmitting a self-contained, verifiable payload between two parties. It is not a session store — it is a signed, portable claim.

The key property: **you can verify the authenticity of a JWT without making a network call**, as long as you trust the signing key.

---

## Anatomy of a JWT

A JWT is a dot-separated string of three Base64URL-encoded parts:

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9   ← Header
.eyJzdWIiOiJ1c2VyXzEyMyIsImlhdCI6MTY...  ← Payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV...  ← Signature
```

### 1. Header

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-2026-08"
}
```

| Field | Purpose                                                                   |
| ----- | ------------------------------------------------------------------------- |
| `alg` | The signing algorithm (e.g., `RS256`, `HS256`)                            |
| `typ` | Token type, always `"JWT"`                                                |
| `kid` | Key ID — identifies which key was used to sign (crucial for key rotation) |

### 2. Payload (Claims)

```json
{
  "sub": "user_abc123",
  "iss": "https://auth.yourapp.com",
  "aud": "https://api.yourapp.com",
  "iat": 1722000000,
  "exp": 1722003600,
  "role": "USER",
  "sessionId": "sess_xyz"
}
```

| Claim | Name       | Purpose                                                             |
| ----- | ---------- | ------------------------------------------------------------------- |
| `sub` | Subject    | Who the token is about (user ID)                                    |
| `iss` | Issuer     | Who issued the token (your auth server URL)                         |
| `aud` | Audience   | Who the token is intended for (your API URL)                        |
| `iat` | Issued At  | Unix timestamp when the token was issued                            |
| `exp` | Expiry     | Unix timestamp after which the token is invalid                     |
| `nbf` | Not Before | Unix timestamp before which the token is not valid (optional)       |
| `jti` | JWT ID     | Unique ID for this token, used to prevent replay attacks (optional) |

> [!IMPORTANT]
> The payload is **Base64URL-encoded, NOT encrypted**. Anyone who holds the token can decode and read it. Never put secrets, passwords, or PII in the payload.

### 3. Signature

The server signs `base64url(header) + "." + base64url(payload)` using its private key (RS256) or shared secret (HS256). The signature guarantees the contents were not tampered with after issuance.

---

## Algorithms: Symmetric vs Asymmetric Signing

This is the most critical security decision when implementing JWTs. Getting it wrong has severe consequences — choosing the wrong algorithm can allow attackers to forge valid tokens for any user in your system.

---

### The Core Problem: Signing vs Verifying

A JWT's value comes from the **signature** on `base64url(header) + "." + base64url(payload)`. The signature proves:

1. The token was issued by a trusted party (authenticity).
2. The content has not been changed since it was issued (integrity).

The algorithm you choose dictates **who can create that signature** and **who can verify it**. These two are the same operation in symmetric cryptography — and completely separate operations in asymmetric cryptography. That distinction is everything.

---

### Symmetric Algorithms (HMAC family)

**How they work:**

HMAC (Hash-based Message Authentication Code) uses a **single secret key** for both signing and verification. The same key that creates the signature must be present to check it.

```
Signing:     signature = HMAC-SHA256(base64url(header) + "." + base64url(payload), secretKey)
Verification: recompute HMAC-SHA256(..., secretKey) → compare with signature
```

Because the math is the same operation, **whoever can verify a token can also create a new one** — they both need the exact same key.

**The HMAC algorithm family in JWT:**

| Algorithm | Hash Function | Key Size (Recommended) | Notes                            |
| --------- | ------------- | ---------------------- | -------------------------------- |
| `HS256`   | SHA-256       | ≥ 256 bits (32 bytes)  | Most common, fast                |
| `HS384`   | SHA-384       | ≥ 384 bits (48 bytes)  | Slightly stronger, rarely needed |
| `HS512`   | SHA-512       | ≥ 512 bits (64 bytes)  | Maximum HMAC strength in JWT     |

**How SHA-256 works in HMAC (simplified):**

```
inner_hash = SHA-256( (secretKey XOR ipad) + message )
outer_hash = SHA-256( (secretKey XOR opad) + inner_hash )
HMAC = outer_hash
```

The key is XOR'd with padding constants (`ipad`, `opad`) before two rounds of SHA-256. This construction prevents length-extension attacks that would affect naive `SHA-256(key + message)`.

**When symmetric (HMAC) works well:**

- A single server process both issues and verifies all tokens (the key never leaves one process).
- Internal service tokens where the issuer and consumer are the same deployed binary.
- Simple prototypes, CLIs, or tools where distributing a shared secret is acceptable.

**The symmetric security trap:**

The moment you need a second service to verify your tokens, you must give that second service the secret key. But that same key lets it also **mint new, arbitrary tokens**. If Service B is compromised, an attacker holds a key they can use to create `{ "sub": "admin", "role": "ADMIN" }` tokens that your auth server would have no way to distinguish from legitimate ones.

This is not theoretical — it is the most common real-world JWT misconfiguration in distributed systems.

---

### Asymmetric Algorithms (RSA and ECDSA families)

**How they work:**

Asymmetric cryptography uses a mathematically linked **key pair**: a private key and a public key. What one key does, only the other key can undo — and you cannot derive one from the other in a reasonable timeframe.

- **Private key:** Held only by the auth server. Used to **sign** tokens.
- **Public key:** Distributed freely. Used to **verify** tokens.

```
Signing:      signature = RSA_sign(base64url(header) + "." + base64url(payload), privateKey)
Verification: RSA_verify(message, signature, publicKey) → valid or invalid
```

A resource server verifying with the public key **cannot sign a new token** — the math only works one way. Compromising a downstream service means an attacker gains only the public key, which is meaningless for forging tokens.

**The RSA algorithm family in JWT:**

RSA (Rivest–Shamir–Adleman) relies on the mathematical difficulty of factoring the product of two large prime numbers.

| Algorithm | Hash Function | Minimum Key Size | Notes                                  |
| --------- | ------------- | ---------------- | -------------------------------------- |
| `RS256`   | SHA-256       | 2048 bits        | Most widely supported, standard choice |
| `RS384`   | SHA-384       | 2048 bits        | Stronger hash, marginal security gain  |
| `RS512`   | SHA-512       | 2048 bits        | Strongest RSA option in JWT            |

**How RSA signing works (simplified):**

1. Compute `hash = SHA-256(message)`.
2. Sign: `signature = hash^privateExponent mod n` (where `n = p × q`, the product of two large primes).
3. Verify: `decrypted = signature^publicExponent mod n` → compare with `hash`.

The security relies on the fact that factoring `n` back into `p` and `q` is computationally infeasible for key sizes ≥ 2048 bits. Signing is computationally expensive (more so than HMAC), but verification is fast.

> [!IMPORTANT]
> Use RSA key sizes of **at least 2048 bits** in production. 1024-bit RSA is considered broken and can be factored with modern hardware. 4096-bit keys provide stronger long-term security at the cost of more CPU time during signing.

**The ECDSA algorithm family in JWT:**

ECDSA (Elliptic Curve Digital Signature Algorithm) is the modern alternative to RSA. It relies on the difficulty of the elliptic curve discrete logarithm problem — a different mathematical hard problem that achieves equivalent security with dramatically smaller key sizes.

| Algorithm | Curve | Key Size | Security Equivalent | Notes                               |
| --------- | ----- | -------- | ------------------- | ----------------------------------- |
| `ES256`   | P-256 | 256 bits | RSA 3072-bit        | Recommended modern choice           |
| `ES384`   | P-384 | 384 bits | RSA 7680-bit        | Used in government/defence contexts |
| `ES512`   | P-521 | 521 bits | RSA 15360-bit       | Maximum ECDSA strength              |

**Why ECDSA over RSA in 2024+:**

- An ES256 key (256 bits) provides roughly the same security as an RS256 key (2048 bits) — at ~10× smaller size.
- Smaller keys mean **faster signing**, **smaller JWTs** (the signature is shorter), and **less bandwidth**.
- The tradeoff: ECDSA requires careful randomness during signing. If the random nonce `k` is reused or predictable even once, the private key can be mathematically recovered. Modern cryptographic libraries handle this correctly, but poorly implemented custom code is dangerous.

**The EdDSA algorithm family in JWT:**

EdDSA (Edwards-curve Digital Signature Algorithm) is the newest family, using the Ed25519 or Ed448 curves. It offers ECDSA's small key size but without the random nonce requirement (it uses a deterministic scheme), making it immune to the ECDSA nonce-reuse attack.

| Algorithm | Curve           | Notes                                               |
| --------- | --------------- | --------------------------------------------------- |
| `EdDSA`   | Ed25519 / Ed448 | Fastest signing, deterministic, safest to implement |

EdDSA is not yet universally supported across all JWT libraries, but is increasingly the preferred choice for new systems with full control over the stack.

---

### The `alg: none` Attack

JWT allows an `alg` header value of `"none"`, meaning no signature is present. This was intended for trusted internal channels. Naive JWT libraries that trust the `alg` value from the incoming token header will accept a forged token with `alg: none` and no signature as valid.

```json
// Header (attacker-crafted):
{ "alg": "none", "typ": "JWT" }

// Payload (attacker-crafted):
{ "sub": "admin", "role": "ADMIN", "exp": 9999999999 }

// No signature — just a trailing dot:
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiJ9.
```

**Mitigation:** Always **explicitly whitelist the algorithms you accept** in your JWT verification call. Never let the incoming token header dictate which algorithm is used.

```typescript
// WRONG — trusts the alg from the token header:
jwt.verify(token, secret);

// CORRECT — explicitly enforces the algorithm:
jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

---

### The Algorithm Confusion Attack

A subtler attack specific to systems that support both HMAC and RSA. If a server is configured to accept tokens signed with either `HS256` or `RS256`, an attacker can:

1. Obtain the server's **public key** (often published at `/.well-known/jwks.json`).
2. Sign a forged token using `HS256` with the **public key as the HMAC secret**.
3. If the server's library resolves `HS256` and uses the public key string as the secret for HMAC verification, it will accept the forged token.

**Mitigation:** Never accept both `HS256` and `RS256` for the same token type. Whitelist exactly one algorithm per token type.

---

### Algorithm Comparison Table

| Property                  | HS256                    | RS256                     | ES256                           | EdDSA (Ed25519)      |
| ------------------------- | ------------------------ | ------------------------- | ------------------------------- | -------------------- |
| Type                      | Symmetric                | Asymmetric (RSA)          | Asymmetric (ECDSA)              | Asymmetric (EdDSA)   |
| Key size                  | 256-bit secret           | 2048-bit key pair         | 256-bit key pair                | 256-bit key pair     |
| Signing speed             | Fastest                  | Slow                      | Fast                            | Fastest (asymmetric) |
| Verification speed        | Fastest                  | Fast                      | Fast                            | Fastest (asymmetric) |
| Token/signature size      | Compact                  | Large                     | Compact                         | Compact              |
| Multiple verifiers safe   | ❌ No                    | ✅ Yes                    | ✅ Yes                          | ✅ Yes               |
| Nonce-reuse vulnerability | N/A                      | No                        | ⚠️ Yes (in bad implementations) | No (deterministic)   |
| Library support           | Universal                | Universal                 | Very good                       | Growing              |
| JWKS support              | No                       | Yes                       | Yes                             | Yes                  |
| Recommended for           | Internal, single-process | Most production use cases | Modern systems                  | Greenfield systems   |

---

### Decision Guide

```
Are multiple services or parties verifying the token?
├─ YES → Use asymmetric (RS256 / ES256 / EdDSA)
│         ├─ Prioritize compatibility → RS256
│         ├─ Prioritize performance + size → ES256
│         └─ Greenfield, full stack control → EdDSA
└─ NO  → Single service only?
          ├─ YES → HS256 is acceptable (but document the constraint clearly)
          └─ UNSURE → Default to RS256; you'll thank yourself later
```

> [!IMPORTANT]
> If your token is verified by more than one service, always use an asymmetric algorithm (RS256, ES256, or EdDSA). Never distribute an HS256 secret to multiple services.

---

## Token Lifecycle

### Access Token (Short-Lived)

- Typical lifetime: **5–15 minutes**.
- Verified locally on the resource server using the public key or shared secret.
- No database lookup required on each request.
- Cannot be explicitly revoked before expiry without maintaining a deny-list.

### Refresh Token (Long-Lived, Opaque)

- Typical lifetime: **7–30 days**.
- Should **not be a JWT** — use an opaque random string.
- Stored (hashed) in the database, checked on every refresh request.
- Can be explicitly revoked by deleting the database row.
- Should trigger rotation on every use (see Token Rotation section below).

The combination of a short-lived JWT access token + long-lived opaque refresh token gives you:

- **Fast stateless API requests** (no DB lookup every time)
- **Explicit revocation capability** (via the refresh token database row)

---

## Token Rotation & Reuse Detection

Refresh token rotation is a critical security pattern. On every call to the refresh endpoint:

1. Client sends its current refresh token.
2. Server validates the token (checks the hash in the database).
3. Server **immediately invalidates** the current token.
4. Server issues a **brand new** access token + refresh token pair to the client.

**Reuse Detection:** If the server receives a refresh token that was previously valid (hash exists historically) but is no longer active (has already been rotated), this indicates the token was stolen and is being replayed by an attacker. The correct response is to:

1. Revoke **all** active sessions for that user.
2. Notify the user via a security alert email.

```
Client          Auth Server          Database
  |-- POST /refresh (token_v1) ------->|
  |                                    |-- Find token_v1 hash ✓ Active
  |                                    |-- Delete token_v1 hash
  |                                    |-- Insert token_v2 hash
  |<-- 200 OK (token_v2) -------------|

  // Later: Attacker replays stolen token_v1
  |-- POST /refresh (token_v1) ------->|
  |                                    |-- Find token_v1 hash ✓ Found (inactive)
  |                                    |-- 🚨 REUSE DETECTED
  |                                    |-- Revoke ALL user sessions
  |<-- 401 Unauthorized ---------------|
```

---

## Cookie vs Authorization Header Delivery

### Cookie Delivery (Recommended for Browser Apps)

```http
Set-Cookie: access_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh_token=abc123; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=2592000
```

| Flag                        | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `HttpOnly`                  | Prevents JavaScript from accessing the cookie (mitigates XSS)                  |
| `Secure`                    | Cookie is only sent over HTTPS                                                 |
| `SameSite=Strict`           | Prevents cookie from being sent on cross-site requests (mitigates CSRF)        |
| `Path=/api/v1/auth/refresh` | **Scope the refresh token cookie** — never expose it to your general API paths |

### Authorization Header (API Clients / Mobile)

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

- Standard for non-browser clients (native apps, server-to-server).
- Access token is stored in memory (not localStorage, which is XSS-vulnerable).
- Refresh token must be stored securely (e.g., iOS Keychain, Android Keystore).

> [!CAUTION]
> Never store JWTs in `localStorage` in a browser application. It is accessible to any JavaScript on the page and is trivially exfiltrated by XSS attacks.

---

## Key Rotation

Long-running services must rotate their signing keys periodically (typically every 90 days). The `kid` (Key ID) header field in the JWT enables this without breaking existing tokens.

### Rotation Process

1. Generate a new RSA key pair.
2. Begin signing **all new tokens** with the new private key and a new `kid` (e.g., `key-2026-11`).
3. Keep the **old public key active** for verification during a grace period (typically 7 days — the max lifetime of an access token issued just before rotation).
4. After the grace period, retire the old public key.

### JWKS (JSON Web Key Set)

A JWKS endpoint (`/.well-known/jwks.json`) serves your public keys to resource servers dynamically, so they can always verify tokens without manual key distribution.

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-2026-08",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## Common Vulnerabilities & Mitigations

| Vulnerability                         | How it happens                                                                   | Mitigation                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Algorithm Confusion (`alg: none`)** | Attacker strips the signature and sets `alg: "none"`. Naive libraries accept it. | Always explicitly specify the expected algorithm in your `jwt.verify()` call. Never trust the `alg` from the token header. |
| **HS256 Secret Brute-Force**          | Short or guessable HS256 secrets can be cracked offline from a captured JWT.     | Use a minimum 256-bit random secret, or switch to RS256.                                                                   |
| **Missing `aud` / `iss` Validation**  | A token issued for Service A is replayed against Service B.                      | Always validate `iss` and `aud` claims during verification.                                                                |
| **XSS Token Theft**                   | Token stored in `localStorage` is read by injected JavaScript.                   | Use `HttpOnly` cookies; never store tokens in `localStorage`.                                                              |
| **Long-lived Access Tokens**          | A stolen access token provides persistent access until expiry.                   | Keep access tokens short-lived (≤15 min). Pair with a revocable refresh token.                                             |
| **No Reuse Detection**                | Stolen refresh token is silently used in parallel.                               | Implement token rotation + reuse detection on every refresh.                                                               |

---

## Verification Checklist

When implementing a JWT verification middleware, always check:

- [ ] **Signature is valid** using the expected algorithm and key.
- [ ] **`exp` has not passed** (token is not expired).
- [ ] **`nbf` has been reached** (token is valid from this point in time).
- [ ] **`iss` matches** your expected issuer.
- [ ] **`aud` matches** your service's identifier.
- [ ] **`kid` is used** to select the correct verification key (for RS256 with key rotation).

---

## Further Reading

- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 7517 — JSON Web Key (JWKS)](https://datatracker.ietf.org/doc/html/rfc7517)
- [jwt.io](https://jwt.io) — Interactive JWT decoder and debugger
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
